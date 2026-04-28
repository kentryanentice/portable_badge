#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN,
    Env, String, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyIssued = 1,
    NotFound = 2,
    NotInitialized = 3,
    AlreadyInitialized = 4,
    UnknownPlan = 5,
    PlanInactive = 6,
    InsufficientPayment = 7,
    DuplicateReceipt = 8,
}

#[contracttype]
#[derive(Clone)]
pub struct Badge {
    pub issuer: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Plan {
    pub credits: u32,
    pub price_stroops: i128,
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct Purchase {
    pub buyer: Address,
    pub plan: Symbol,
    pub credits: u32,
    pub paid_stroops: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Badge(BytesN<32>),
    // Credit-system keys
    Admin,
    XlmToken,                 // SAC address for native XLM
    Treasury,                 // address that receives credit payments
    Plan(Symbol),             // 'starter' | 'pro' | 'enterprise'
    Purchase(BytesN<32>),     // receipt_id -> Purchase (idempotency)
}

const LEDGERS_PER_DAY: u32 = 17_280;
const TTL_THRESHOLD: u32 = LEDGERS_PER_DAY * 30;
const TTL_EXTEND: u32 = LEDGERS_PER_DAY * 365;

#[contract]
pub struct BadgeContract;

#[contractimpl]
impl BadgeContract {
    // ─── Initialization ───────────────────────────────────────────────────────

    /// One-time setup. `xlm_token` is the Stellar Asset Contract id for native
    /// XLM on the chosen network; `treasury` is where credit payments land.
    pub fn init(env: Env, admin: Address, xlm_token: Address, treasury: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        Ok(())
    }

    pub fn admin(env: Env) -> Option<Address>    { env.storage().instance().get(&DataKey::Admin) }
    pub fn treasury(env: Env) -> Option<Address> { env.storage().instance().get(&DataKey::Treasury) }
    pub fn xlm_token(env: Env) -> Option<Address> { env.storage().instance().get(&DataKey::XlmToken) }

    /// Admin-only. Creates or updates a plan in contract storage.
    pub fn set_plan(env: Env, id: Symbol, credits: u32, price_stroops: i128, active: bool) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        admin.require_auth();

        env.storage().persistent().set(
            &DataKey::Plan(id.clone()),
            &Plan { credits, price_stroops, active },
        );
        env.storage().persistent().extend_ttl(&DataKey::Plan(id.clone()), TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("plan_set"), admin),
            (id, credits, price_stroops, active),
        );
        Ok(())
    }

    pub fn get_plan(env: Env, id: Symbol) -> Option<Plan> {
        env.storage().persistent().get(&DataKey::Plan(id))
    }

    // ─── Credit purchase ──────────────────────────────────────────────────────

    /// Buyer signs this invocation. The contract pulls `plan.price_stroops`
    /// of XLM from buyer → treasury via the Stellar Asset Contract, then
    /// stores an immutable Purchase receipt and emits a `purchased` event.
    ///
    /// `receipt_id` is a 32-byte client-generated nonce — duplicates are
    /// rejected on-chain (idempotency for retries / accidental double-submits).
    ///
    /// Returns the credits granted by this purchase.
    pub fn purchase(env: Env, buyer: Address, plan_id: Symbol, receipt_id: BytesN<32>) -> Result<u32, Error> {
        buyer.require_auth();

        if env.storage().persistent().has(&DataKey::Purchase(receipt_id.clone())) {
            return Err(Error::DuplicateReceipt);
        }

        let plan: Plan = env.storage().persistent()
            .get(&DataKey::Plan(plan_id.clone()))
            .ok_or(Error::UnknownPlan)?;
        if !plan.active { return Err(Error::PlanInactive); }

        let xlm: Address      = env.storage().instance().get(&DataKey::XlmToken).ok_or(Error::NotInitialized)?;
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).ok_or(Error::NotInitialized)?;

        // Atomic: if the buyer can't pay (insufficient balance / no
        // trustline), this aborts the entire contract call.
        token::Client::new(&env, &xlm).transfer(&buyer, &treasury, &plan.price_stroops);

        let purchase = Purchase {
            buyer:        buyer.clone(),
            plan:         plan_id.clone(),
            credits:      plan.credits,
            paid_stroops: plan.price_stroops,
            timestamp:    env.ledger().timestamp(),
        };
        env.storage().persistent().set(&DataKey::Purchase(receipt_id.clone()), &purchase);
        env.storage().persistent().extend_ttl(&DataKey::Purchase(receipt_id.clone()), TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("purchased"), buyer.clone()),
            (plan_id, plan.credits, plan.price_stroops, receipt_id, treasury),
        );
        Ok(plan.credits)
    }

    pub fn get_purchase(env: Env, receipt_id: BytesN<32>) -> Option<Purchase> {
        env.storage().persistent().get(&DataKey::Purchase(receipt_id))
    }

    // ─── Document badge (existing) ────────────────────────────────────────────

    /// Anchor a document hash on-chain.
    ///
    /// `issuer` is the platform key (the backend's stellar identity)
    /// and is the only signer the contract requires.
    /// `owner` is the user's wallet address (from Freighter); it isn't
    /// stored to keep rent low, but is published in the event so an
    /// indexer can attribute the badge to its owner.
    pub fn issue(
        env: Env,
        issuer: Address,
        owner: Address,
        blake3_hash: BytesN<32>,
        recipient: String,
        email: String,
        title: String,
    ) -> Result<(), Error> {
        issuer.require_auth();

        let key = DataKey::Badge(blake3_hash.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyIssued);
        }

        let badge = Badge {
            issuer: issuer.clone(),
            timestamp: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &badge);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("issued"), issuer),
            (blake3_hash, owner, recipient, email, title),
        );

        Ok(())
    }

    pub fn get(env: Env, blake3_hash: BytesN<32>) -> Option<Badge> {
        env.storage()
            .persistent()
            .get(&DataKey::Badge(blake3_hash))
    }

    pub fn exists(env: Env, blake3_hash: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Badge(blake3_hash))
    }
}

#[cfg(test)]
mod test;
