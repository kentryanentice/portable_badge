# Stellar / Freighter integration

This repo was originally Sui + Slush. The Stellar swap keeps the same UX
shape but moves the on-chain write **server-side**: the user signs into
the app with Freighter (so we know who owns the badge), the backend then
uses its own Stellar identity to issue the on-chain anchor.

## Architecture

```
┌──────────────┐   POST /document                ┌──────────────┐
│  pb_frontend │ ──────────────────────────────▶ │  pb_engine   │
│              │   x-wallet: G...                │              │
│ Freighter    │   file, title, recipient, email │              │
│ (identity)   │                                 │   ┌──────────┴──────────┐
│              │                                 │   │  stellar contract   │
│              │                                 │   │  invoke ... issue   │
│              │                                 │   └──────────┬──────────┘
│              │                                 │              │
│              │                                 │     Soroban testnet
│              │                                 │              ▼
│              │                                 │   pb_contract_stellar
│              │                                 │              │
│              │                                 │   tx hash    ▼
│              │                                 │   stored in postgres
│              │ ◀── badge PDF                   │              │
│              │     x-blake3-hash               │              │
│              │     x-stellar-hash ─────────────┘              │
└──────────────┘     x-stellar-error (on failure)               │
                                                                 │
   ┌─────────────────────────────────────────────────────────────┘
   ▼
documents.stellar_hash  → linked from /documents UI to stellar.expert
```

The badged PDF, document metadata, and BLAKE3 hash live in Postgres
(source of truth). Soroban anchors only the **32-byte hash + issuer +
timestamp** — minimising rent — and emits an event carrying the user's
wallet (`owner`), recipient, email, and title for off-chain indexers.

## What changed vs. the old Sui flow

| Layer       | Before                                 | After                                            |
|-------------|----------------------------------------|--------------------------------------------------|
| Wallet      | `@mysten/dapp-kit` + Slush             | `@stellar/freighter-api` + Freighter             |
| Frontend    | Read user's Sui address, never signed  | Read user's Stellar address, never signs         |
| Contract    | Move (`pb_contract/`)                  | Soroban Rust (`pb_contract_stellar/`)            |
| Who calls?  | (the digest column was always Pending) | **Backend** signs and submits during `/document` |
| DB column   | `sui_digest` (kept-not-used)           | `stellar_hash` (`sui_digest` dropped)            |

The frontend has zero @stellar/stellar-sdk code now — it only connects
Freighter, reads `address`, sends it as `x-wallet`, and reads the
returned `x-stellar-hash` header.

## One-time setup

### 1. Soroban contract

```bash
cargo install --locked stellar-cli         # if you don't have it

cd pb_contract_stellar
stellar contract build

# Funded testnet identity (this becomes the on-chain `issuer`)
stellar keys generate --global pb-deployer --network testnet --fund

# Deploy
stellar contract deploy \
  --wasm target/wasm32v1-none/release/pb_contract_stellar.wasm \
  --source pb-deployer \
  --network testnet \
  --alias pb_badge
```

The CLI prints a contract id like `CABCDEF...XYZ`.

### 2. Backend env

Add to `pb_engine/.env`:

```bash
STELLAR_CONTRACT_ID=C...                # the id from step 1
STELLAR_SOURCE_KEY=pb-deployer          # the key alias from step 1
STELLAR_NETWORK=testnet
# STELLAR_BIN=stellar                   # override if `stellar` isn't on PATH
```

The backend resolves `pb-deployer`'s G… address at startup. Make sure
the `stellar` CLI is reachable in the process's PATH and the keystore
that holds `pb-deployer` is on the same machine (default is
`~/.config/soroban/identity/` on Linux, `%APPDATA%\soroban\identity\`
on Windows).

### 3. Database

```bash
psql "$DATABASE_URL" -f pb_engine/src/migrations/003_add_stellar_hash.sql
psql "$DATABASE_URL" -f pb_engine/src/migrations/004_drop_sui_digest.sql
```

Fresh installs will get the right schema directly from
`001_create_documents.sql` (the `sui_digest` column has been removed
from there too). The two extra files are only needed for DBs that were
already created with the old schema.

### 4. Frontend

```bash
cd pb_frontend
npm install
npm run dev
```

That's it — the frontend doesn't need a contract id or RPC URL
configured. Only `VITE_STELLAR_NETWORK=TESTNET|PUBLIC` is read, and
just to pick which stellar.expert URL to link out to.

## Going to mainnet

1. `stellar keys generate --global pb-deployer-mainnet --network mainnet`
   then fund it (you have ~400k XLM, so just send some over).
2. `stellar contract deploy ... --network mainnet --alias pb_badge_mainnet`.
3. Update `pb_engine/.env`:
   - `STELLAR_CONTRACT_ID=` (the new mainnet id)
   - `STELLAR_SOURCE_KEY=pb-deployer-mainnet`
   - `STELLAR_NETWORK=mainnet`
4. Update `pb_frontend/.env`: `VITE_STELLAR_NETWORK=PUBLIC`.

## Failure mode notes

- If the `stellar` CLI subprocess fails (network down, key missing,
  tx errors), the document is **still saved** and the badge PDF is
  still returned. The error message is surfaced via the
  `x-stellar-error` response header so the upload UI can show
  "Saved off-chain. Anchor failed: ...".
- The CLI invocation has a 45s timeout; on testnet a normal call
  takes ~5–8 seconds.
- Anchored entries get a 1-year TTL extension on every issue. To
  prevent expiration of long-lived hashes, either re-anchor or run
  a `stellar contract extend` cron against the entry keys.
