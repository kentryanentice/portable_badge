#![cfg(test)]

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, String,
};

fn setup() -> (Env, Address, Address, BadgeContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(BadgeContract, ());
    let client = BadgeContractClient::new(&env, &id);
    let issuer = Address::generate(&env);
    let owner = Address::generate(&env);
    (env, issuer, owner, client)
}

#[test]
fn issues_and_reads_badge() {
    let (env, issuer, owner, client) = setup();
    let hash = BytesN::from_array(&env, &[7u8; 32]);

    client.issue(
        &issuer,
        &owner,
        &hash,
        &String::from_str(&env, "Alice"),
        &String::from_str(&env, "alice@example.com"),
        &String::from_str(&env, "Diploma"),
    );

    assert!(client.exists(&hash));
    let badge = client.get(&hash).unwrap();
    assert_eq!(badge.issuer, issuer);
}

#[test]
#[should_panic]
fn rejects_duplicate_hash() {
    let (env, issuer, owner, client) = setup();
    let hash = BytesN::from_array(&env, &[1u8; 32]);
    let r = String::from_str(&env, "A");
    let e = String::from_str(&env, "a@b.c");
    let t = String::from_str(&env, "T");

    client.issue(&issuer, &owner, &hash, &r, &e, &t);
    client.issue(&issuer, &owner, &hash, &r, &e, &t);
}

// ─── Credit purchase tests ──────────────────────────────────────────────────

fn setup_credits() -> (
    Env,
    Address,           // admin
    Address,           // treasury
    Address,           // buyer
    Address,           // xlm token id
    BadgeContractClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(BadgeContract, ());
    let client = BadgeContractClient::new(&env, &id);

    let admin    = Address::generate(&env);
    let treasury = Address::generate(&env);
    let buyer    = Address::generate(&env);

    // Register a mock token contract to act as the XLM SAC.
    let token_admin = Address::generate(&env);
    let xlm_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();

    // Mint XLM to the buyer.
    let token_admin_client = StellarAssetClient::new(&env, &xlm_id);
    token_admin_client.mint(&buyer, &1_000_000_000); // 100 XLM in stroops

    client.init(&admin, &xlm_id, &treasury);

    (env, admin, treasury, buyer, xlm_id, client)
}

#[test]
fn purchase_transfers_xlm_and_records_receipt() {
    let (env, _admin, treasury, buyer, xlm_id, client) = setup_credits();

    client.set_plan(&symbol_short!("starter"), &10, &50_000_000, &true);

    let xlm = TokenClient::new(&env, &xlm_id);
    assert_eq!(xlm.balance(&buyer), 1_000_000_000);
    assert_eq!(xlm.balance(&treasury), 0);

    let receipt = BytesN::from_array(&env, &[1u8; 32]);
    let credits = client.purchase(&buyer, &symbol_short!("starter"), &receipt);

    assert_eq!(credits, 10);
    assert_eq!(xlm.balance(&buyer),    950_000_000);
    assert_eq!(xlm.balance(&treasury),  50_000_000);

    let p = client.get_purchase(&receipt).unwrap();
    assert_eq!(p.buyer,        buyer);
    assert_eq!(p.credits,      10);
    assert_eq!(p.paid_stroops, 50_000_000);
}

#[test]
#[should_panic]
fn purchase_rejects_duplicate_receipt() {
    let (env, _a, _t, buyer, _x, client) = setup_credits();
    client.set_plan(&symbol_short!("starter"), &10, &50_000_000, &true);
    let receipt = BytesN::from_array(&env, &[2u8; 32]);
    client.purchase(&buyer, &symbol_short!("starter"), &receipt);
    client.purchase(&buyer, &symbol_short!("starter"), &receipt);
}

#[test]
#[should_panic]
fn purchase_rejects_inactive_plan() {
    let (env, _a, _t, buyer, _x, client) = setup_credits();
    client.set_plan(&symbol_short!("starter"), &10, &50_000_000, &false);
    let receipt = BytesN::from_array(&env, &[3u8; 32]);
    client.purchase(&buyer, &symbol_short!("starter"), &receipt);
}

#[test]
#[should_panic]
fn purchase_rejects_unknown_plan() {
    let (env, _a, _t, buyer, _x, client) = setup_credits();
    let receipt = BytesN::from_array(&env, &[4u8; 32]);
    client.purchase(&buyer, &symbol_short!("nope"), &receipt);
}
