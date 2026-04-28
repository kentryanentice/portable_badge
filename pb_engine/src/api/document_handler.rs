use axum::{Extension, Json, extract::{Multipart, Query}, http::{HeaderMap, StatusCode, header}, response::Response, body::Body};
use lopdf::{Document, Object, Stream, Dictionary, StringFormat};
use lopdf::content::{Content, Operation};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::infra::mailer::{self, MailerConfig};
use crate::infra::stellar::{self, StellarConfig};

type E = (StatusCode, &'static str);

fn wallet(headers: &HeaderMap) -> Result<String, E> {
    headers.get("x-wallet")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .ok_or((StatusCode::UNAUTHORIZED, "Missing wallet"))
}

// ── Badge page generation ─────────────────────────────────────────────────────

fn txt(ops: &mut Vec<Operation>, text: &str, size: f32, x: f32, y: f32, font: &[u8]) {
    ops.push(Operation::new("BT", vec![]));
    ops.push(Operation::new("Tf", vec![Object::Name(font.to_vec()), Object::Real(size)]));
    ops.push(Operation::new("Tm", vec![
        Object::Real(1.0), Object::Real(0.0), Object::Real(0.0), Object::Real(1.0),
        Object::Real(x), Object::Real(y),
    ]));
    ops.push(Operation::new("Tj", vec![
        Object::String(text.as_bytes().to_vec(), StringFormat::Literal),
    ]));
    ops.push(Operation::new("ET", vec![]));
}

fn hline(ops: &mut Vec<Operation>, y: f32) {
    ops.push(Operation::new("w",  vec![Object::Real(0.4)]));
    ops.push(Operation::new("m",  vec![Object::Real(50.0), Object::Real(y)]));
    ops.push(Operation::new("l",  vec![Object::Real(545.0), Object::Real(y)]));
    ops.push(Operation::new("S",  vec![]));
}

fn append_badge_page(original: &[u8], title: &str, recipient: &str, email: &str, hash: &str, issued_at: &str) -> Result<Vec<u8>, String> {
    let mut doc = Document::load_mem(original).map_err(|e| e.to_string())?;

    let (w, h) = (595.28_f32, 841.89_f32);
    let mut ops: Vec<Operation> = vec![];

    // Header background (dark navy)
    ops.push(Operation::new("rg", vec![Object::Real(0.10), Object::Real(0.16), Object::Real(0.24)]));
    ops.push(Operation::new("re", vec![Object::Real(0.0), Object::Real(781.0), Object::Real(w), Object::Real(60.0)]));
    ops.push(Operation::new("f",  vec![]));

    // White text on header
    ops.push(Operation::new("g", vec![Object::Real(1.0)]));
    txt(&mut ops, "PORTABLE BADGE",                        20.0, 50.0, 811.0, b"F2");
    txt(&mut ops, "Document Verification Certificate",     10.0, 50.0, 793.0, b"F1");

    // Back to black
    ops.push(Operation::new("g", vec![Object::Real(0.0)]));

    // Border
    ops.push(Operation::new("w",  vec![Object::Real(0.8)]));
    ops.push(Operation::new("re", vec![Object::Real(30.0), Object::Real(30.0), Object::Real(w - 60.0), Object::Real(740.0)]));
    ops.push(Operation::new("S",  vec![]));

    // Section label
    txt(&mut ops, "DOCUMENT DETAILS", 7.5, 50.0, 748.0, b"F2");
    hline(&mut ops, 740.0);

    // Fields
    txt(&mut ops, "Title",     8.0, 50.0, 718.0, b"F2");
    txt(&mut ops, title,      11.0, 50.0, 703.0, b"F1");

    txt(&mut ops, "Recipient", 8.0, 50.0, 678.0, b"F2");
    txt(&mut ops, recipient,  11.0, 50.0, 663.0, b"F1");

    txt(&mut ops, "Email",     8.0, 50.0, 638.0, b"F2");
    txt(&mut ops, email,      11.0, 50.0, 623.0, b"F1");

    txt(&mut ops, "Issued",    8.0, 50.0, 598.0, b"F2");
    txt(&mut ops, issued_at,  11.0, 50.0, 583.0, b"F1");

    // Hash section
    hline(&mut ops, 560.0);
    txt(&mut ops, "BLAKE3 VERIFICATION HASH", 7.5, 50.0, 545.0, b"F2");

    // Hash box (light gray bg)
    ops.push(Operation::new("rg", vec![Object::Real(0.95), Object::Real(0.95), Object::Real(0.95)]));
    ops.push(Operation::new("re", vec![Object::Real(50.0), Object::Real(498.0), Object::Real(495.0), Object::Real(36.0)]));
    ops.push(Operation::new("f",  vec![]));
    ops.push(Operation::new("g",  vec![Object::Real(0.0)]));

    let (h1, h2) = hash.split_at(hash.len() / 2);
    txt(&mut ops, h1, 7.5, 56.0, 524.0, b"F1");
    txt(&mut ops, h2, 7.5, 56.0, 510.0, b"F1");

    // Note
    hline(&mut ops, 480.0);
    txt(&mut ops, "This certificate verifies the authenticity of the document above.", 8.0, 50.0, 463.0, b"F1");
    txt(&mut ops, "Any modification — even a single byte — will produce a different hash.", 8.0, 50.0, 449.0, b"F1");

    // Footer
    hline(&mut ops, 55.0);
    txt(&mut ops, "Verified by Portable Badge  |  On-Chain Document Verification", 7.5, 50.0, 42.0, b"F1");

    let content_bytes = Content { operations: ops }.encode().map_err(|e| e.to_string())?;

    // Fonts
    let mut f1 = Dictionary::new();
    f1.set("Type",     Object::Name(b"Font".to_vec()));
    f1.set("Subtype",  Object::Name(b"Type1".to_vec()));
    f1.set("BaseFont", Object::Name(b"Helvetica".to_vec()));
    let f1_id = doc.add_object(f1);

    let mut f2 = Dictionary::new();
    f2.set("Type",     Object::Name(b"Font".to_vec()));
    f2.set("Subtype",  Object::Name(b"Type1".to_vec()));
    f2.set("BaseFont", Object::Name(b"Helvetica-Bold".to_vec()));
    let f2_id = doc.add_object(f2);

    let mut fonts = Dictionary::new();
    fonts.set("F1", Object::Reference(f1_id));
    fonts.set("F2", Object::Reference(f2_id));
    let mut res = Dictionary::new();
    res.set("Font", Object::Dictionary(fonts));

    let stream_id = doc.add_object(Stream::new(Dictionary::new(), content_bytes));

    // Get pages root id before mutable borrows
    let pages_id = {
        let catalog = doc.catalog().map_err(|e| e.to_string())?;
        catalog.get(b"Pages").map_err(|e| e.to_string())?.as_reference().map_err(|e| e.to_string())?
    };

    // Create page
    let mut page = Dictionary::new();
    page.set("Type",     Object::Name(b"Page".to_vec()));
    page.set("Parent",   Object::Reference(pages_id));
    page.set("MediaBox", Object::Array(vec![Object::Integer(0), Object::Integer(0), Object::Real(w), Object::Real(h)]));
    page.set("Contents", Object::Reference(stream_id));
    page.set("Resources", Object::Dictionary(res));
    let page_id = doc.add_object(page);

    // Add page to tree
    let pages = doc.get_object_mut(pages_id).map_err(|e| e.to_string())?.as_dict_mut().map_err(|e| e.to_string())?;
    let count = pages.get(b"Count").and_then(|c| c.as_i64()).unwrap_or(0);
    pages.set("Count", Object::Integer(count + 1));
    pages.get_mut(b"Kids").map_err(|e| e.to_string())?.as_array_mut().map_err(|e| e.to_string())?.push(Object::Reference(page_id));

    let mut buf = Vec::new();
    doc.save_to(&mut std::io::BufWriter::new(&mut buf)).map_err(|e| e.to_string())?;
    Ok(buf)
}

// ── Handlers ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct DocumentResponse {
    pub id:           String,
    pub title:        String,
    pub recipient:    String,
    pub email:        String,
    pub blake3_hash:  String,
    pub stellar_hash: Option<String>,
    pub created_at:   String,
}

#[derive(Deserialize)]
pub struct ListParams {
    pub page:     Option<u32>,
    pub per_page: Option<u32>,
}

#[derive(Serialize)]
pub struct ListResponse {
    pub items:    Vec<DocumentResponse>,
    pub total:    i64,
    pub page:     u32,
    pub per_page: u32,
}

#[derive(Serialize)]
pub struct VerifyResponse {
    pub id:           String,
    pub title:        String,
    pub recipient:    String,
    pub email:        String,
    pub blake3_hash:  String,
    pub stellar_hash: Option<String>,
    pub created_at:   String,
}

pub async fn upload(
    Extension(pool): Extension<PgPool>,
    Extension(stellar_cfg): Extension<Option<StellarConfig>>,
    Extension(mailer_cfg): Extension<Option<MailerConfig>>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Response<Body>, E> {
    let wallet = wallet(&headers)?;

    let mut file_bytes: Option<Vec<u8>> = None;
    let mut title     = String::new();
    let mut recipient = String::new();
    let mut email     = String::new();

    while let Some(field) = multipart.next_field().await
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid multipart"))?
    {
        match field.name() {
            Some("file")      => { file_bytes = Some(field.bytes().await.map_err(|_| (StatusCode::BAD_REQUEST, "Failed to read file"))?.to_vec()); }
            Some("title")     => { title     = field.text().await.unwrap_or_default(); }
            Some("recipient") => { recipient = field.text().await.unwrap_or_default(); }
            Some("email")     => { email     = field.text().await.unwrap_or_default(); }
            _ => {}
        }
    }

    let bytes = file_bytes.ok_or((StatusCode::BAD_REQUEST, "Missing file"))?;
    if title.is_empty() || recipient.is_empty() || email.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Missing fields"));
    }

    let original_hash = blake3::hash(&bytes).to_hex().to_string();

    // Generate badged PDF
    let issued_at = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let badge_bytes = append_badge_page(&bytes, &title, &recipient, &email, &original_hash, &issued_at)
        .map_err(|e| { tracing::error!("Badge gen: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "Badge generation failed") })?;
    let badge_hash = blake3::hash(&badge_bytes).to_hex().to_string();

    // Pricing. Email is only charged when the mailer is actually configured;
    // otherwise no email goes out and the user shouldn't pay for it.
    const UPLOAD_COST: i32 = 20;
    const EMAIL_COST:  i32 = 30;
    let email_cost = if mailer_cfg.is_some() { EMAIL_COST } else { 0 };
    let total_cost = UPLOAD_COST + email_cost;

    // Atomic: lock wallet row, deduct credits, insert document, write ledger
    // entries. The DB CHECK (balance >= 0) and the FOR UPDATE row lock prevent
    // overdraw and double-spend even under concurrent uploads.
    let mut db_tx = pool.begin().await
        .map_err(|e| { tracing::error!("DB tx begin: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    let bal_row = sqlx::query("SELECT balance FROM public.wallet_credits WHERE wallet = $1 FOR UPDATE")
        .persistent(false)
        .bind(&wallet)
        .fetch_optional(&mut *db_tx).await
        .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;
    let current_balance: i32 = bal_row.and_then(|r| r.try_get("balance").ok()).unwrap_or(0);
    if current_balance < total_cost {
        return Err((StatusCode::PAYMENT_REQUIRED, "Insufficient credits"));
    }

    sqlx::query(
        "UPDATE public.wallet_credits SET balance = balance - $1, updated_at = NOW() WHERE wallet = $2"
    )
    .persistent(false)
    .bind(total_cost)
    .bind(&wallet)
    .execute(&mut *db_tx).await
    .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    let row = sqlx::query(
        "INSERT INTO public.documents (wallet, title, recipient, email, blake3_hash, file_bytes, badge_hash, badge_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id"
    )
    .persistent(false)
    .bind(&wallet)
    .bind(&title)
    .bind(&recipient)
    .bind(&email)
    .bind(&original_hash)
    .bind(&bytes)
    .bind(&badge_hash)
    .bind(&badge_bytes)
    .fetch_one(&mut *db_tx).await
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("duplicate key") || msg.contains("unique constraint") {
            (StatusCode::CONFLICT, "Document already exists")
        } else {
            tracing::error!("DB: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "DB error")
        }
    })?;

    let document_uuid: Uuid = row.try_get("id").unwrap();
    let id = document_uuid.to_string();

    // One ledger row per upload. The memo encodes the breakdown:
    //   'upload'        -> only document upload (no email)
    //   'upload+email'  -> upload + email delivery
    // If email later fails, a separate 'refund' row is written to undo
    // the email portion specifically — that one stays as its own row
    // because it happens at a different time and is its own auditable event.
    let memo = if email_cost > 0 { "upload+email" } else { "upload" };
    sqlx::query(
        "INSERT INTO public.credit_transactions (wallet, delta, reason, document_id, memo) VALUES ($1, $2, 'consume', $3, $4)"
    )
    .persistent(false)
    .bind(&wallet)
    .bind(-total_cost)
    .bind(document_uuid)
    .bind(memo)
    .execute(&mut *db_tx).await
    .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    db_tx.commit().await
        .map_err(|e| { tracing::error!("DB commit: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    // Anchor on Stellar. Best-effort: if it fails the document still
    // exists in the DB and the user keeps the badge PDF — we just
    // surface the error in a response header so the frontend can show it.
    let mut stellar_hash = String::new();
    let mut stellar_err  = String::new();
    if let Some(cfg) = stellar_cfg.as_ref() {
        match stellar::anchor(cfg, &wallet, &original_hash, &recipient, &email, &title).await {
            Ok(h) => {
                stellar_hash = h;
                if let Err(e) = sqlx::query(
                    "UPDATE public.documents SET stellar_hash = $1 WHERE id = $2"
                )
                .persistent(false)
                .bind(&stellar_hash)
                .bind(document_uuid)
                .execute(&pool).await {
                    tracing::error!("Failed to persist stellar_hash for {id}: {e}");
                }
            }
            Err(e) => {
                tracing::error!("Stellar anchor failed for {id}: {e}");
                stellar_err = e;
            }
        }
    }

    // Email the recipient a copy of the badged PDF. Best-effort:
    // failures are logged and never block the response.
    if let Some(cfg) = mailer_cfg.as_ref() {
        let stellar_url: Option<String> = if !stellar_hash.is_empty() {
            let net = stellar_cfg.as_ref()
                .map(|c| c.network.as_str())
                .unwrap_or("testnet");
            let base = if net == "mainnet" || net == "public" {
                "https://stellar.expert/explorer/public"
            } else {
                "https://stellar.expert/explorer/testnet"
            };
            Some(format!("{base}/tx/{stellar_hash}"))
        } else {
            None
        };

        let cfg          = cfg.clone();
        let pdf          = badge_bytes.clone();
        let recipient    = email.clone();
        let doc_title    = title.clone();
        let document_id  = id.clone();
        let original     = original_hash.clone();
        let issuer       = wallet.clone();
        let pool         = pool.clone();
        let refund_doc   = document_uuid;
        let refund_wallet = wallet.clone();
        tokio::spawn(async move {
            if let Err(e) = mailer::send_badge_email(
                &cfg, &recipient, &doc_title, &pdf, &document_id, &original, &issuer,
                stellar_url.as_deref(),
            ).await {
                tracing::error!("Mailer failed for {document_id}: {e}");

                // Refund the email cost. Best-effort — if this fails the
                // user will need a manual reconciliation, but we log it.
                let refund_result: Result<(), sqlx::Error> = async {
                    let mut tx = pool.begin().await?;
                    sqlx::query(
                        "UPDATE public.wallet_credits SET balance = balance + $1, updated_at = NOW() WHERE wallet = $2"
                    )
                    .persistent(false)
                    .bind(EMAIL_COST)
                    .bind(&refund_wallet)
                    .execute(&mut *tx).await?;
                    sqlx::query(
                        "INSERT INTO public.credit_transactions (wallet, delta, reason, document_id, memo)
                         VALUES ($1, $2, 'refund', $3, 'email_failed')"
                    )
                    .persistent(false)
                    .bind(&refund_wallet)
                    .bind(EMAIL_COST)
                    .bind(refund_doc)
                    .execute(&mut *tx).await?;
                    tx.commit().await
                }.await;
                if let Err(e) = refund_result {
                    tracing::error!("Email refund failed for {document_id}: {e}");
                }
            }
        });
    }

    let filename = format!("attachment; filename=\"badge_{}.pdf\"", title.replace(' ', "_"));

    let mut builder = Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/pdf")
        .header(header::CONTENT_DISPOSITION, filename)
        .header("x-document-id", &id)
        .header("x-blake3-hash", &original_hash);

    if !stellar_hash.is_empty() {
        builder = builder.header("x-stellar-hash", &stellar_hash);
    }
    if !stellar_err.is_empty() {
        let truncated: String = stellar_err.chars().take(200).collect();
        let safe: String = truncated.chars()
            .filter(|c| !c.is_control() || *c == ' ')
            .collect();
        builder = builder.header("x-stellar-error", safe);
    }

    builder
        .body(Body::from(badge_bytes))
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Response error"))
}

pub async fn list(
    Extension(pool): Extension<PgPool>,
    headers: HeaderMap,
    Query(params): Query<ListParams>,
) -> Result<Json<ListResponse>, E> {
    let wallet = wallet(&headers)?;

    let page     = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(10).clamp(1, 100);
    let offset   = ((page - 1) * per_page) as i64;

    let total: i64 = sqlx::query("SELECT COUNT(*) AS n FROM public.documents WHERE wallet = $1")
        .persistent(false)
        .bind(&wallet)
        .fetch_one(&pool).await
        .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?
        .try_get("n").unwrap_or(0);

    let rows = sqlx::query(
        "SELECT id, title, recipient, email, blake3_hash, stellar_hash, created_at
         FROM public.documents WHERE wallet = $1 ORDER BY created_at DESC
         LIMIT $2 OFFSET $3"
    )
    .persistent(false)
    .bind(&wallet)
    .bind(per_page as i64)
    .bind(offset)
    .fetch_all(&pool).await
    .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    let items = rows.into_iter().map(|r| DocumentResponse {
        id:           r.try_get::<Uuid, _>("id").unwrap().to_string(),
        title:        r.try_get("title").unwrap(),
        recipient:    r.try_get("recipient").unwrap(),
        email:        r.try_get("email").unwrap(),
        blake3_hash:  r.try_get("blake3_hash").unwrap(),
        stellar_hash: r.try_get("stellar_hash").unwrap_or(None),
        created_at:   r.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").unwrap().to_rfc3339(),
    }).collect();

    Ok(Json(ListResponse { items, total, page, per_page }))
}

/// Returns true if the PDF bytes contain the Portable Badge certificate page.
/// Checks for two unique markers written into the badge content stream.
fn has_portable_badge(bytes: &[u8]) -> bool {
    let has = |needle: &[u8]| bytes.windows(needle.len()).any(|w| w == needle);
    has(b"PORTABLE BADGE") && has(b"BLAKE3 VERIFICATION HASH")
}

pub async fn verify(
    Extension(pool): Extension<PgPool>,
    mut multipart: Multipart,
) -> Result<Response<Body>, E> {
    let mut file_bytes: Option<Vec<u8>> = None;

    while let Some(field) = multipart.next_field().await
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid multipart"))?
    {
        if field.name() == Some("file") {
            file_bytes = Some(field.bytes().await.map_err(|_| (StatusCode::BAD_REQUEST, "Failed to read file"))?.to_vec());
        }
    }

    let bytes = file_bytes.ok_or((StatusCode::BAD_REQUEST, "Missing file"))?;
    let hash  = blake3::hash(&bytes).to_hex().to_string();

    // Match against badge_hash (badged copy) OR blake3_hash (original)
    let row = sqlx::query(
        "SELECT id, title, recipient, email, blake3_hash, stellar_hash, created_at
         FROM public.documents WHERE badge_hash = $1 OR blake3_hash = $1 LIMIT 1"
    )
    .persistent(false)
    .bind(&hash)
    .fetch_optional(&pool).await
    .map_err(|e| { tracing::error!("DB: {e}"); (StatusCode::INTERNAL_SERVER_ERROR, "DB error") })?;

    match row {
        Some(row) => {
            let resp = VerifyResponse {
                id:           row.try_get::<Uuid, _>("id").unwrap().to_string(),
                title:        row.try_get("title").unwrap(),
                recipient:    row.try_get("recipient").unwrap(),
                email:        row.try_get("email").unwrap(),
                blake3_hash:  row.try_get("blake3_hash").unwrap(),
                stellar_hash: row.try_get("stellar_hash").unwrap_or(None),
                created_at:   row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").unwrap().to_rfc3339(),
            };
            let body = serde_json::to_string(&resp)
                .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Serialization error"))?;
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body))
                .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Response error"))
        }
        None if has_portable_badge(&bytes) => {
            // PDF carries a Portable Badge certificate but its hash is not in the database —
            // the document was modified after the badge was issued.
            Err((StatusCode::CONFLICT, "Document tampered"))
        }
        None => {
            // No badge detected and no record found — document was never registered.
            Err((StatusCode::NOT_FOUND, "Document not found"))
        }
    }
}
