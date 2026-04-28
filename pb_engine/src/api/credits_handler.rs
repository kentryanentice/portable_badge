use axum::{Extension, Json, extract::Query, http::{HeaderMap, StatusCode}};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::infra::horizon::{self, HorizonConfig};
use crate::infra::mailer::MailerConfig;

const UPLOAD_COST: i32 = 20;
const EMAIL_COST:  i32 = 30;

type E = (StatusCode, &'static str);

fn wallet(headers: &HeaderMap) -> Result<String, E> {
    headers.get("x-wallet")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty() && s.starts_with('G') && s.len() == 56)
        .ok_or((StatusCode::UNAUTHORIZED, "Missing or invalid wallet"))
}

#[derive(Serialize)]
pub struct Plan {
    pub id:            String,
    pub label:         String,
    pub credits:       i32,
    pub price_stroops: i64,
}

#[derive(Serialize)]
pub struct PlansResponse { pub items: Vec<Plan>, pub treasury: Option<String> }

pub async fn list_plans(
    Extension(pool):    Extension<PgPool>,
    Extension(horizon): Extension<Option<HorizonConfig>>,
) -> Result<Json<PlansResponse>, E> {
    let rows = sqlx::query(
        "SELECT id, label, credits, price_stroops FROM public.plans WHERE active = TRUE ORDER BY price_stroops ASC"
    )
    .persistent(false)
    .fetch_all(&pool).await
    .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    let items = rows.into_iter().map(|r| Plan {
        id:            r.try_get("id").unwrap(),
        label:         r.try_get("label").unwrap(),
        credits:       r.try_get("credits").unwrap(),
        price_stroops: r.try_get("price_stroops").unwrap(),
    }).collect();

    Ok(Json(PlansResponse { items, treasury: horizon.map(|c| c.treasury) }))
}

#[derive(Serialize)]
pub struct BalanceResponse {
    pub wallet:        String,
    pub balance:       i32,
    /// Total credits the next upload will consume given the server's
    /// current mailer configuration. Frontend uses this for the
    /// pre-flight balance check.
    pub upload_cost:   i32,
    pub email_enabled: bool,
}

pub async fn balance(
    Extension(pool):       Extension<PgPool>,
    Extension(mailer_cfg): Extension<Option<MailerConfig>>,
    headers: HeaderMap,
) -> Result<Json<BalanceResponse>, E> {
    let wallet = wallet(&headers)?;

    let row = sqlx::query("SELECT balance FROM public.wallet_credits WHERE wallet = $1")
        .persistent(false)
        .bind(&wallet)
        .fetch_optional(&pool).await
        .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    let balance: i32 = row.and_then(|r| r.try_get("balance").ok()).unwrap_or(0);
    let email_enabled = mailer_cfg.is_some();
    let upload_cost = UPLOAD_COST + if email_enabled { EMAIL_COST } else { 0 };
    Ok(Json(BalanceResponse { wallet, balance, upload_cost, email_enabled }))
}

#[derive(Deserialize)]
pub struct PurchaseRequest {
    pub plan_id:         String,
    pub stellar_tx_hash: String,
}

#[derive(Serialize)]
pub struct PurchaseResponse {
    pub credits_added:   i32,
    pub new_balance:     i32,
    pub stellar_tx_hash: String,
    pub transaction_id:  String,
}

/// Verifies the payment on Horizon, then atomically records the purchase
/// and bumps the wallet balance. The Stellar tx itself is the on-chain
/// audit trail — it's permanently recorded on the public ledger.
pub async fn purchase(
    Extension(pool):    Extension<PgPool>,
    Extension(horizon): Extension<Option<HorizonConfig>>,
    Json(body):         Json<PurchaseRequest>,
) -> Result<Json<PurchaseResponse>, E> {
    let horizon = horizon.ok_or((StatusCode::SERVICE_UNAVAILABLE, "Stellar verification not configured"))?;

    // Verify the on-chain payment first — no DB needed. The tx source is the
    // wallet to credit; we don't trust an x-wallet header here.
    let verified = horizon::verify_payment(&horizon, &body.stellar_tx_hash).await
        .map_err(|e| {
            tracing::warn!("Horizon verify failed for {}: {e}", body.stellar_tx_hash);
            (StatusCode::BAD_REQUEST, "Stellar payment verification failed")
        })?;

    // All DB queries run inside a single explicit transaction. Supavisor's
    // transaction-mode pooler pins one Postgres backend for the duration of
    // BEGIN…COMMIT, so the unnamed prepared statement can't bleed across
    // queries from other connections (which causes the "bind message
    // supplies N parameters but prepared statement requires 0" error).
    let mut tx = pool.begin().await
        .map_err(|e| { tracing::error!("DB tx begin: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    let plan_row = sqlx::query(
        "SELECT credits, price_stroops FROM public.plans WHERE id = $1 AND active = TRUE"
    )
    .persistent(false)
    .bind(&body.plan_id)
    .fetch_optional(&mut *tx).await
    .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?
    .ok_or((StatusCode::BAD_REQUEST, "Unknown plan"))?;

    let plan_credits:  i32 = plan_row.try_get("credits").unwrap();
    let plan_stroops:  i64 = plan_row.try_get("price_stroops").unwrap();

    if verified.amount_stroops < plan_stroops {
        return Err((StatusCode::BAD_REQUEST, "Insufficient payment for plan"));
    }

    // Reject duplicate use of the same Stellar tx hash. The UNIQUE index is
    // the real guard; this gives a friendlier error.
    let existing = sqlx::query("SELECT 1 FROM public.credit_transactions WHERE stellar_tx_hash = $1")
        .persistent(false)
        .bind(&body.stellar_tx_hash)
        .fetch_optional(&mut *tx).await
        .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;
    if existing.is_some() {
        return Err((StatusCode::CONFLICT, "Stellar tx already redeemed"));
    }

    let inserted = sqlx::query(
        "INSERT INTO public.credit_transactions (wallet, delta, reason, plan_id, stellar_tx_hash, memo)
         VALUES ($1, $2, 'purchase', $3, $4, $5) RETURNING id"
    )
    .persistent(false)
    .bind(&verified.source)
    .bind(plan_credits)
    .bind(&body.plan_id)
    .bind(&body.stellar_tx_hash)
    .bind(&verified.memo)
    .fetch_one(&mut *tx).await
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("duplicate key") || msg.contains("unique constraint") {
            (StatusCode::CONFLICT, "Stellar tx already redeemed")
        } else {
            tracing::error!("DB: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "DB error")
        }
    })?;
    let transaction_id: Uuid = inserted.try_get("id").unwrap();

    let updated = sqlx::query(
        "INSERT INTO public.wallet_credits (wallet, balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (wallet) DO UPDATE
           SET balance = public.wallet_credits.balance + EXCLUDED.balance,
               updated_at = NOW()
         RETURNING balance"
    )
    .persistent(false)
    .bind(&verified.source)
    .bind(plan_credits)
    .fetch_one(&mut *tx).await
    .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;
    let new_balance: i32 = updated.try_get("balance").unwrap();

    tx.commit().await
        .map_err(|e| { tracing::error!("DB commit: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    Ok(Json(PurchaseResponse {
        credits_added: plan_credits,
        new_balance,
        stellar_tx_hash: body.stellar_tx_hash,
        transaction_id: transaction_id.to_string(),
    }))
}

#[derive(Deserialize)]
pub struct ListParams {
    pub page:     Option<u32>,
    pub per_page: Option<u32>,
}

#[derive(Serialize)]
pub struct TransactionItem {
    pub id:                 String,
    pub delta:              i32,
    pub reason:             String,
    pub plan_id:            Option<String>,
    /// For purchases: the user's payment tx. For consumes: NULL — see
    /// `document_stellar_hash` instead, which is the badge-anchor tx.
    pub stellar_tx_hash:    Option<String>,
    pub document_id:        Option<String>,
    pub document_title:     Option<String>,
    pub document_stellar_hash: Option<String>,
    /// Subtype: 'upload' | 'email' | 'email_failed' (refund) | empty for legacy rows.
    pub memo:               Option<String>,
    pub created_at:         String,
}

#[derive(Serialize)]
pub struct TransactionsResponse {
    pub items:    Vec<TransactionItem>,
    pub total:    i64,
    pub balance:  i32,
    pub page:     u32,
    pub per_page: u32,
}

pub async fn list_transactions(
    Extension(pool): Extension<PgPool>,
    headers: HeaderMap,
    Query(params): Query<ListParams>,
) -> Result<Json<TransactionsResponse>, E> {
    let wallet = wallet(&headers)?;

    let page     = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset   = ((page - 1) * per_page) as i64;

    let total: i64 = sqlx::query("SELECT COUNT(*) AS n FROM public.credit_transactions WHERE wallet = $1")
        .persistent(false)
        .bind(&wallet)
        .fetch_one(&pool).await
        .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?
        .try_get("n").unwrap_or(0);

    let balance: i32 = sqlx::query("SELECT balance FROM public.wallet_credits WHERE wallet = $1")
        .persistent(false)
        .bind(&wallet)
        .fetch_optional(&pool).await
        .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?
        .and_then(|r| r.try_get("balance").ok()).unwrap_or(0);

    let rows = sqlx::query(
        "SELECT ct.id, ct.delta, ct.reason, ct.plan_id, ct.stellar_tx_hash,
                ct.document_id, ct.memo, ct.created_at,
                d.title        AS document_title,
                d.stellar_hash AS document_stellar_hash
         FROM public.credit_transactions ct
         LEFT JOIN public.documents d ON d.id = ct.document_id
         WHERE ct.wallet = $1
         ORDER BY ct.created_at DESC LIMIT $2 OFFSET $3"
    )
    .persistent(false)
    .bind(&wallet)
    .bind(per_page as i64)
    .bind(offset)
    .fetch_all(&pool).await
    .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    let items = rows.into_iter().map(|r| TransactionItem {
        id:                    r.try_get::<Uuid, _>("id").unwrap().to_string(),
        delta:                 r.try_get("delta").unwrap(),
        reason:                r.try_get("reason").unwrap(),
        plan_id:               r.try_get("plan_id").unwrap_or(None),
        stellar_tx_hash:       r.try_get("stellar_tx_hash").unwrap_or(None),
        document_id:           r.try_get::<Option<Uuid>, _>("document_id").unwrap_or(None).map(|u| u.to_string()),
        document_title:        r.try_get("document_title").unwrap_or(None),
        document_stellar_hash: r.try_get("document_stellar_hash").unwrap_or(None),
        memo:                  r.try_get("memo").unwrap_or(None),
        created_at:            r.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").unwrap().to_rfc3339(),
    }).collect();

    Ok(Json(TransactionsResponse { items, total, balance, page, per_page }))
}
