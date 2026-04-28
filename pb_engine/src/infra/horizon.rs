//! Verifies a Stellar payment transaction against Horizon. The Stellar
//! tx hash IS the on-chain audit trail for credit purchases — stellar.expert
//! links resolve directly to it.
//!
//! Required env:
//!   STELLAR_NETWORK     "testnet" (default) | "public"
//!   STELLAR_TREASURY    G... address that receives credit payments
//!   HORIZON_URL         optional override; defaults based on network

use serde::Deserialize;
use std::env;
use std::time::Duration;

#[derive(Clone, Debug)]
pub struct HorizonConfig {
    pub url:      String,
    pub treasury: String,
    pub network:  String,
}

impl HorizonConfig {
    pub fn from_env() -> Option<Self> {
        let treasury = env::var("STELLAR_TREASURY").ok().filter(|s| !s.is_empty())?;
        let network  = env::var("STELLAR_NETWORK").unwrap_or_else(|_| "testnet".to_string());
        let url      = env::var("HORIZON_URL").ok().filter(|s| !s.is_empty()).unwrap_or_else(|| {
            if network == "public" || network == "mainnet" {
                "https://horizon.stellar.org".to_string()
            } else {
                "https://horizon-testnet.stellar.org".to_string()
            }
        });
        Some(HorizonConfig { url, treasury, network })
    }
}

#[derive(Debug, Deserialize)]
struct TxResource {
    successful:     bool,
    source_account: String,
    memo_type:      Option<String>,
    memo:           Option<String>,
}

#[derive(Debug, Deserialize)]
struct OperationsPage { _embedded: Embedded }

#[derive(Debug, Deserialize)]
struct Embedded { records: Vec<Operation> }

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum Operation {
    #[serde(rename = "payment")]
    Payment {
        from:       String,
        to:         String,
        amount:     String,
        asset_type: String,
    },
    #[serde(other)]
    Other,
}

#[derive(Debug)]
pub struct VerifiedPayment {
    pub source:         String,    // payer's G... address (the wallet to credit)
    pub amount_stroops: i64,       // amount in stroops (1 XLM = 10_000_000)
    pub memo:           String,
}

/// Fetches a tx by hash and asserts:
///   - tx succeeded
///   - has at least one native-XLM payment from `source` to the treasury
///   - returns (source, amount_stroops, memo) for the matching payment
///
/// If multiple matching payments exist (rare), we sum the stroops.
pub async fn verify_payment(cfg: &HorizonConfig, tx_hash: &str) -> Result<VerifiedPayment, String> {
    if tx_hash.len() != 64 || !tx_hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("invalid stellar tx hash".into());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("client build: {e}"))?;

    let tx_url = format!("{}/transactions/{}", cfg.url.trim_end_matches('/'), tx_hash);
    let tx_resp = client.get(&tx_url).send().await.map_err(|e| format!("horizon: {e}"))?;
    if tx_resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err("tx not found on horizon".into());
    }
    if !tx_resp.status().is_success() {
        return Err(format!("horizon tx fetch {}", tx_resp.status()));
    }
    let tx: TxResource = tx_resp.json().await.map_err(|e| format!("horizon tx decode: {e}"))?;
    if !tx.successful {
        return Err("tx did not succeed on chain".into());
    }

    let memo = match (tx.memo_type.as_deref(), tx.memo.as_deref()) {
        (Some("text"), Some(m)) => m.to_string(),
        _ => String::new(),
    };

    let ops_url = format!("{}/transactions/{}/operations?limit=200", cfg.url.trim_end_matches('/'), tx_hash);
    let ops_resp = client.get(&ops_url).send().await.map_err(|e| format!("horizon ops: {e}"))?;
    if !ops_resp.status().is_success() {
        return Err(format!("horizon ops fetch {}", ops_resp.status()));
    }
    let ops: OperationsPage = ops_resp.json().await.map_err(|e| format!("horizon ops decode: {e}"))?;

    let mut total_stroops: i64 = 0;
    let mut payer: Option<String> = None;

    for op in ops._embedded.records {
        if let Operation::Payment { from, to, amount, asset_type } = op {
            if asset_type != "native" { continue; }
            if to != cfg.treasury { continue; }
            let stroops = amount_to_stroops(&amount)?;
            total_stroops = total_stroops.checked_add(stroops)
                .ok_or("amount overflow".to_string())?;
            payer = Some(payer.unwrap_or(from.clone()));
            // If multiple payments from different payers exist in one tx,
            // reject — ambiguity about whose credits to bump.
            if payer.as_deref() != Some(&from) {
                return Err("tx contains payments from multiple sources".into());
            }
        }
    }

    if total_stroops == 0 {
        return Err("no XLM payment to treasury found in tx".into());
    }
    let source = payer.unwrap_or(tx.source_account);

    if !source.starts_with('G') || source.len() != 56 {
        return Err(format!("invalid source account: {source}"));
    }

    Ok(VerifiedPayment { source, amount_stroops: total_stroops, memo })
}

/// Horizon returns amounts as decimal strings like "12.3456789".
/// 1 XLM = 10_000_000 stroops. Always exactly 7 decimal places.
fn amount_to_stroops(s: &str) -> Result<i64, String> {
    let s = s.trim();
    let (whole, frac) = match s.split_once('.') {
        Some((w, f)) => (w, f),
        None => (s, ""),
    };
    if whole.is_empty() || !whole.chars().all(|c| c.is_ascii_digit()) {
        return Err(format!("bad amount: {s}"));
    }
    let mut frac = frac.to_string();
    if frac.len() > 7 { return Err(format!("amount has > 7 decimals: {s}")); }
    while frac.len() < 7 { frac.push('0'); }
    if !frac.chars().all(|c| c.is_ascii_digit()) {
        return Err(format!("bad amount: {s}"));
    }
    let combined = format!("{whole}{frac}");
    combined.parse::<i64>().map_err(|e| format!("amount parse: {e}"))
}
