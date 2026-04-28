//! Sends a copy of the issued badge PDF to the recipient via the
//! pb_email_mailer Cloudflare Worker. Best-effort: failures are logged
//! and never block the upload response — the user already has the PDF.
//!
//! Required env:
//!   MAILER_URL  — the Worker endpoint, e.g. https://pb-email-mail.<acct>.workers.dev

use base64::{Engine as _, engine::general_purpose::STANDARD as B64};
use serde::Serialize;
use std::env;
use std::time::Duration;

#[derive(Clone, Debug)]
pub struct MailerConfig {
    pub url: String,
}

impl MailerConfig {
    pub fn from_env() -> Option<Self> {
        env::var("MAILER_URL").ok().filter(|s| !s.is_empty()).map(|url| MailerConfig { url })
    }
}

#[derive(Serialize)]
struct EmailPayload<'a> {
    #[serde(rename = "recipientEmail")] recipient_email: &'a str,
    #[serde(rename = "docTitle")]       doc_title:       &'a str,
    #[serde(rename = "pdfBase64")]      pdf_base64:      String,
    #[serde(rename = "documentId")]     document_id:     &'a str,
    hash:                                                &'a str,
    issuer:                                              &'a str,
    #[serde(rename = "stellarUrl", skip_serializing_if = "Option::is_none")]
    stellar_url:                                         Option<&'a str>,
}

pub async fn send_badge_email(
    cfg:             &MailerConfig,
    recipient_email: &str,
    doc_title:       &str,
    pdf_bytes:       &[u8],
    document_id:     &str,
    hash:            &str,
    issuer:          &str,
    stellar_url:     Option<&str>,
) -> Result<(), String> {
    let payload = EmailPayload {
        recipient_email,
        doc_title,
        pdf_base64: B64.encode(pdf_bytes),
        document_id,
        hash,
        issuer,
        stellar_url,
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("client build: {e}"))?;

    let resp = client.post(&cfg.url)
        .json(&payload)
        .send().await
        .map_err(|e| format!("request: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("mailer {status}: {body}"));
    }
    Ok(())
}
