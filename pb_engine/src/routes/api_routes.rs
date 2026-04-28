use axum::{Router, extract::DefaultBodyLimit, routing::{get, post}};
use axum::extract::Extension;
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};
use sqlx::PgPool;
use crate::api::{credits_handler, document_handler};

async fn keepalive(Extension(pool): Extension<PgPool>) -> (StatusCode, Json<Value>) {
    match sqlx::query("SELECT 1").persistent(false).execute(&pool).await {
        Ok(_) => (StatusCode::OK, Json(json!({ "status": "ok", "db": "reachable" }))),
        Err(e) => (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "status": "error", "db": e.to_string() }))),
    }
}

pub fn routes() -> Router {
    Router::new()
        .route("/keepalive",            get(keepalive))
        .route("/documents",            get(document_handler::list))
        .route("/document",             post(document_handler::upload))
        .route("/document/verify",      post(document_handler::verify))
        .route("/credits/plans",        get(credits_handler::list_plans))
        .route("/credits/balance",      get(credits_handler::balance))
        .route("/credits/purchase",     post(credits_handler::purchase))
        .route("/credits/transactions", get(credits_handler::list_transactions))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
}
