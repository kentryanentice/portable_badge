//! Anchors a document hash on Stellar by invoking the Soroban contract
//! via the `stellar` CLI as a subprocess. The CLI handles XDR
//! construction, simulation/footprint negotiation, signing, and
//! submission — which would be ~500 lines of native code to replicate.
//!
//! Required env:
//!   STELLAR_BIN          (default: "stellar")
//!   STELLAR_CONTRACT_ID  (the C... contract id from `stellar contract deploy`)
//!   STELLAR_SOURCE_KEY   (key alias funded on the target network)
//!   STELLAR_NETWORK      (default: "testnet")
//!   STELLAR_ISSUER_ADDR  (optional; resolved from SOURCE_KEY at startup if unset)

use std::env;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

#[derive(Clone, Debug)]
pub struct StellarConfig {
    pub bin:         String,
    pub contract_id: String,
    pub source_key:  String,
    pub network:     String,
    pub issuer:      String,
}

impl StellarConfig {
    pub async fn from_env() -> Option<Self> {
        let bin         = env::var("STELLAR_BIN").unwrap_or_else(|_| "stellar".to_string());
        let contract_id = env::var("STELLAR_CONTRACT_ID").ok()?;
        let source_key  = env::var("STELLAR_SOURCE_KEY").ok()?;
        let network     = env::var("STELLAR_NETWORK").unwrap_or_else(|_| "testnet".to_string());

        let issuer = match env::var("STELLAR_ISSUER_ADDR") {
            Ok(a) if !a.is_empty() => a,
            _ => match resolve_address(&bin, &source_key).await {
                Ok(a) => a,
                Err(e) => {
                    tracing::warn!("Stellar disabled: cannot resolve source key '{source_key}': {e}");
                    return None;
                }
            },
        };

        Some(StellarConfig { bin, contract_id, source_key, network, issuer })
    }
}

async fn resolve_address(bin: &str, alias: &str) -> Result<String, String> {
    let out = Command::new(bin)
        .args(["keys", "address", alias])
        .output().await
        .map_err(|e| format!("spawn failed: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    let addr = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !addr.starts_with('G') {
        return Err(format!("unexpected address output: {addr:?}"));
    }
    Ok(addr)
}

/// Anchor a document on-chain. Returns the transaction hash on success.
///
/// `owner` should be the user's Stellar address from Freighter. Recipient/
/// email/title are emitted in the contract event but not stored on-chain.
pub async fn anchor(
    cfg: &StellarConfig,
    owner: &str,
    blake3_hex: &str,
    recipient: &str,
    email: &str,
    title: &str,
) -> Result<String, String> {
    if blake3_hex.len() != 64 || !blake3_hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("blake3 hash must be 64 hex chars".into());
    }
    if !owner.starts_with('G') || owner.len() != 56 {
        return Err(format!("invalid owner address: {owner}"));
    }

    let fut = Command::new(&cfg.bin)
        .args([
            "contract", "invoke",
            "--id",      &cfg.contract_id,
            "--source",  &cfg.source_key,
            "--network", &cfg.network,
            "--send",    "yes",
            "--",
            "issue",
            "--issuer",      &cfg.issuer,
            "--owner",       owner,
            "--blake3_hash", blake3_hex,
            "--recipient",   recipient,
            "--email",       email,
            "--title",       title,
        ])
        .output();

    let out = timeout(Duration::from_secs(45), fut).await
        .map_err(|_| "stellar invoke timed out after 45s".to_string())?
        .map_err(|e| format!("spawn failed: {e}"))?;

    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);

    if !out.status.success() {
        return Err(format!("stellar invoke failed: {}", stderr.trim()));
    }

    extract_tx_hash(&stdout, &stderr)
        .ok_or_else(|| format!("could not extract tx hash from CLI output:\nstdout: {stdout}\nstderr: {stderr}"))
}

/// Stellar CLI prints the tx hash in a few different shapes depending on
/// the version. We scan both streams for a 64-char hex token following
/// any of the known phrases.
fn extract_tx_hash(stdout: &str, stderr: &str) -> Option<String> {
    let needles = [
        "transaction with hash",
        "Submitted transaction",
        "Hash:",
        "tx hash:",
    ];
    for stream in [stdout, stderr] {
        for line in stream.lines() {
            let l = line.to_lowercase();
            if needles.iter().any(|n| l.contains(&n.to_lowercase())) {
                if let Some(h) = scan_hex64(line) {
                    return Some(h);
                }
            }
        }
        if let Some(h) = scan_hex64(stream) {
            return Some(h);
        }
    }
    None
}

fn scan_hex64(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut i = 0;
    while i + 64 <= bytes.len() {
        let slice = &bytes[i..i + 64];
        if slice.iter().all(|b| b.is_ascii_hexdigit()) {
            let before = if i == 0 { b' ' } else { bytes[i - 1] };
            let after = if i + 64 == bytes.len() { b' ' } else { bytes[i + 64] };
            if !before.is_ascii_hexdigit() && !after.is_ascii_hexdigit() {
                return Some(std::str::from_utf8(slice).ok()?.to_lowercase());
            }
        }
        i += 1;
    }
    None
}
