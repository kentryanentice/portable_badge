pub mod api;
pub mod infra;
mod routes;

use axum::http::HeaderValue;
use axum::{extract::Extension, http::Method, middleware::{self}};
use dotenvy::dotenv;
use infra::db::init_db_pool;
use infra::horizon::HorizonConfig;
use infra::limiter::{ConcurrencyLimiter, enforce_concurrency};
use infra::mailer::MailerConfig;
use infra::rate::{RateLimiter, enforce_rate_limit};
use infra::stellar::StellarConfig;
use routes::api_routes;
use std::{env, time::Duration};
use tower_http::{cors::{AllowOrigin, CorsLayer}, set_header::SetResponseHeaderLayer, trace::TraceLayer};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    dotenv().ok();

    let limiter = ConcurrencyLimiter::new(20);

    let device_secret = env::var("DEVICE_SECRET").unwrap_or_default();
    let rate_limiter = RateLimiter::new(1000, Duration::from_secs(60), device_secret);

    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());

    let client_url = env::var("CLIENT_URL").unwrap_or_else(|_| "http://localhost:5173".to_string());
    let origin = HeaderValue::from_str(&client_url).expect("Invalid CLIENT_URL");

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([origin]))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
            axum::http::header::HeaderName::from_static("x-wallet"),
        ])
        .expose_headers([
            axum::http::header::HeaderName::from_static("x-blake3-hash"),
            axum::http::header::HeaderName::from_static("x-document-id"),
            axum::http::header::HeaderName::from_static("x-stellar-hash"),
            axum::http::header::HeaderName::from_static("x-stellar-error"),
        ]);

    let db_pool = init_db_pool().await;

    let stellar = StellarConfig::from_env().await;
    if stellar.is_some() {
        println!("Stellar anchoring enabled");
    } else {
        println!("Stellar anchoring disabled (set STELLAR_CONTRACT_ID + STELLAR_SOURCE_KEY to enable)");
    }

    let mailer = MailerConfig::from_env();
    if mailer.is_some() {
        println!("Email delivery enabled");
    } else {
        println!("Email delivery disabled (set MAILER_URL to enable)");
    }

    let horizon = HorizonConfig::from_env();
    if horizon.is_some() {
        println!("Credit purchase verification enabled");
    } else {
        println!("Credit purchase verification disabled (set STELLAR_TREASURY to enable)");
    }

    let app = api_routes::routes()
        .layer(Extension(db_pool))
        .layer(Extension(stellar))
        .layer(Extension(mailer))
        .layer(Extension(horizon))
        .layer(middleware::from_fn(move |req, next| {
            enforce_rate_limit(rate_limiter.clone(), req, next)
        }))
        .layer(middleware::from_fn(move |req, next| {
            enforce_concurrency(limiter.clone(), req, next)
        }))
        .layer(cors)
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static("default-src 'none'"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("permissions-policy"),
            HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
        ))
        .layer(TraceLayer::new_for_http());

    let addr = format!("0.0.0.0:{port}");
    println!("Server running on http://{addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>()).await.unwrap();
}
