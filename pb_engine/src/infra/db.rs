use sqlx::{PgPool, postgres::PgPoolOptions};
use std::env;
use std::time::Duration;

// NOTE: we connect through a transaction-mode pooler (PgBouncer / Supavisor),
// which multiplexes one client connection across many physical Postgres
// backends. Named prepared statements collide on reused backends, so every
// `sqlx::query(...)` in this app must be marked `.persistent(false)` to force
// sqlx to use the unnamed-statement protocol.
pub async fn init_db_pool() -> PgPool {
    let db_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set")
        .trim()
        .to_string();

    PgPoolOptions::new()
        .max_connections(5)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(10))
        // .idle_timeout(Duration::from_secs(30))
        // .max_lifetime(Duration::from_secs(300))
        .connect_lazy(&db_url)
        .expect("Failed to connect to PostgreSQL via pooler")
}
