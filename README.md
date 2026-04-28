# Portable Badge

Cryptographic document verification, anchored on Stellar.

Upload any PDF, get back a copy with an embedded certificate page and a
BLAKE3 fingerprint anchored on-chain via a Soroban smart contract. Drop
the file onto the verify page later — the engine returns one of three
states: **Verified**, **Tampered**, or **Not Found**.

## Deployed contract (Stellar testnet)

| Field        | Value |
|--------------|-------|
| **Contract ID** | `CBDUVFTBSNECWY5B5VEWJ4FI5XIOX4SZNBEKW3W5RMSFEHLO725ZRNYG` |
| Network      | Testnet (`Test SDF Network ; September 2015`) |
| Deploy tx    | [`1cc4cbb9…`](https://stellar.expert/explorer/testnet/tx/1cc4cbb9490f6ce5bf1defb204cee81ee16fcd0a2b2bb8cab7d9667ab09ecb95) |
| WASM upload  | [`e43269e3…`](https://stellar.expert/explorer/testnet/tx/e43269e32c09b640dcf7109fb0557b7e53b58694e2efb34a817f1bf6446990f1) |
| Explorer     | https://stellar.expert/explorer/testnet/contract/CBDUVFTBSNECWY5B5VEWJ4FI5XIOX4SZNBEKW3W5RMSFEHLO725ZRNYG |
| Source       | [`pb_contract_stellar/`](pb_contract_stellar/) |

The contract exposes three entrypoints — `issue(issuer, owner, blake3_hash, recipient, email, title)`, `get(blake3_hash)`, and `exists(blake3_hash)` — and is called server-side by `pb_engine` on every successful upload.

## Repository layout

```
portable-badge/
├── pb_contract_stellar/   Soroban smart contract (Rust, no_std)
├── pb_engine/             Backend — Rust · Axum · sqlx · lopdf
├── pb_frontend/           Frontend — React · TypeScript · Vite · Freighter
```

## Architecture

```
┌──────────────┐   POST /document                ┌──────────────┐
│  pb_frontend │ ──────────────────────────────▶ │  pb_engine   │
│  + Freighter │   x-wallet: G... (Stellar addr) │              │
│  (identity)  │   file, title, recipient, email │   stellar    │
│              │                                 │   contract   │
│              │                                 │   invoke     │
│              │                                 │      │       │
│              │                                 │      ▼       │
│              │                                 │  Soroban tx  │
│              │ ◀── badge PDF                   │      │       │
│              │     x-blake3-hash               │      ▼       │
│              │     x-stellar-hash ─────────────┘  Postgres    │
└──────────────┘                                                 │
```

`pb_engine` shells out to the official `stellar` CLI to invoke the
contract. The platform's Stellar key signs every anchor — end users
connect Freighter purely as identity (the connected address becomes the
on-chain `owner` of the badge), they never pay gas.

## Prerequisites

- Rust (latest stable) and `cargo`
- Node.js 20+ and `npm`
- PostgreSQL 14+ (or a Supabase URL)
- Stellar CLI: `cargo install --locked stellar-cli`
- A Stellar testnet account funded with friendbot (or use Freighter and
  import its secret key into the CLI)

## Setup

### 1. Smart contract

The contract is **already deployed on testnet** — id above. You only
need to redeploy if you change the contract source.

```powershell
cd pb_contract_stellar
stellar contract build

# If you don't have a key alias yet, import your Freighter secret:
stellar keys add my-wallet --secret-key
stellar keys address my-wallet     # should match your Freighter address

# Optional — only if the testnet account has never been funded:
stellar keys fund my-wallet --network testnet

# Redeploy (skip this to use the already-deployed contract above)
stellar contract deploy `
  --wasm target/wasm32v1-none/release/pb_contract_stellar.wasm `
  --source my-wallet `
  --network testnet `
  --alias pb_badge
```

### 3. Backend (`pb_engine`)

`pb_engine/.env`:

```env
DATABASE_URL=postgresql://...
CLIENT_URL=http://localhost:5173
PORT=8080
DEVICE_SECRET=replace-with-a-long-random-string

STELLAR_CONTRACT_ID=
STELLAR_SOURCE_KEY=my-wallet
STELLAR_NETWORK=testnet
```

Run:

```powershell
cd pb_engine
cargo run
```

You should see:

```
Stellar anchoring enabled
Server running on http://0.0.0.0:8080
```

If it says `Stellar anchoring disabled (...)`, the backend couldn't
reach the `stellar` CLI or the key alias — check that `stellar` is on
PATH for whichever shell starts `cargo run`.

### 4. Frontend (`pb_frontend`)

`pb_frontend/.env`:

```env
VITE_API_URL=http://localhost:8080
VITE_STELLAR_NETWORK=TESTNET
```

Run:

```powershell
cd pb_frontend
npm install
npm run dev
```

Open http://localhost:5173, connect Freighter, and you're live.

## End-to-end smoke test

1. Open http://localhost:5173/auth, click **Connect Freighter**.
2. Navigate to **/upload**, drop a PDF, fill in recipient name + email + title.
3. Click **Upload**. After ~5–10 seconds:
   - The badged PDF auto-downloads.
   - The result row shows a clickable `on-chain` link to stellar.expert.
4. Open **/documents** — the row shows an **On-chain** badge linking
   to the same transaction.
5. Open **/verify**, drop the downloaded PDF — green **Verified** state.
6. Edit one byte in a hex editor, save, drop again — red **Tampered**.

## Production / mainnet

- Generate a separate `pb-deployer-mainnet` identity, fund it, and
  redeploy the contract with `--network mainnet`.
- Update `STELLAR_CONTRACT_ID`, `STELLAR_SOURCE_KEY`, `STELLAR_NETWORK`
  in `pb_engine/.env`.
- Set `VITE_STELLAR_NETWORK=PUBLIC` in `pb_frontend/.env` so explorer
  links go to the public stellar.expert.
- Each anchor costs roughly 0.5 – 2 XLM in rent. Persistent entries
  receive a 1-year TTL extension on every issuance.

See [STELLAR_MIGRATION.md](STELLAR_MIGRATION.md) for the full
architectural rationale and migration notes.

## License

Hackathon project — all rights reserved unless otherwise noted.
