# pb_contract_stellar

Soroban smart contract that anchors Portable Badge document hashes on Stellar.

## What it stores

Per the cost model on Soroban (per-byte storage + rent), only the
**32-byte BLAKE3 hash** and **issuer** are kept on-chain. The recipient,
email, and title travel through a contract event so off-chain indexers
can pick them up cheaply, while the database remains the source of truth
for full document records.

## Build

```bash
cd pb_contract_stellar
stellar contract build
# wasm at target/wasm32v1-none/release/pb_contract_stellar.wasm
# (older toolchains: target/wasm32-unknown-unknown/release/pb_contract_stellar.wasm)
```

## Test

```bash
cargo test
```

## Deploy (testnet)

```bash
# Configure a key
stellar keys generate --global pb-deployer --network testnet --fund

# Deploy
stellar contract deploy \
  --wasm target/wasm32v1-none/release/pb_contract_stellar.wasm \
  --source pb-deployer \
  --network testnet \
  --alias pb_badge

# The CLI prints a contract id like:
#   CABCDEF...XYZ
# Paste it into pb_frontend/.env as VITE_STELLAR_CONTRACT_ID
```

## Invoke (smoke test)

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source pb-deployer \
  --network testnet \
  -- issue \
  --issuer <YOUR_ADDRESS> \
  --blake3_hash 0000000000000000000000000000000000000000000000000000000000000001 \
  --recipient "Alice" \
  --email "alice@example.com" \
  --title "Test"
```
