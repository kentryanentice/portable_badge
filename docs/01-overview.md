# Overview

> Audience: Anyone trying to understand what Portable Badge is, where it came from, and why it exists. Read this first.

---

## What is Portable Badge?

Portable Badge is a cryptographic document verification system. It lets institutions issue PDFs — diplomas, transcripts, certificates, contracts, anything — in a way that any third party can later confirm as **authentic and unmodified**, without phoning the issuer or checking a centralized database.

The core idea is simple: when an institution issues a document, we compute a cryptographic fingerprint (a BLAKE3 hash) of the file's bytes, anchor that fingerprint on the **Stellar blockchain**, and embed a human-readable certificate page into the PDF itself. From that point on, the document carries its own proof.

Anyone with the file can drop it onto our public Verify page and get one of three answers in under a second:

- ✅ **Verified** — the document is authentic and byte-identical to what the issuer registered
- ⚠️ **Tampered** — the document carries our certificate page but has been modified since issuance
- ❌ **Not Found** — the document is not registered with Portable Badge

No login, no account, no wallet required to verify.

---

## Where it came from: from EduSeal to Portable Badge

Portable Badge began as **EduSeal**, a school-registrar verification tool aimed at solving one specific problem: fake diplomas and altered transcripts in the Davao region.

### The EduSeal phase

EduSeal was a closed system designed for one institution at a time. A registrar's office would upload a document, the system would compute a hash, and verifiers — typically employers or other universities — could query the school's portal to confirm the hash matched. It worked, but it had three architectural limits:

1. **Centralized.** The proof of authenticity lived only in the issuing school's database. If that database went offline, lost data, or was compromised, the proof was gone.
2. **Per-school.** Every partner institution needed its own deployment, its own login flow, and its own verifier portal. There was no way for an employer to verify documents from multiple schools through a single tool.
3. **Trust-based, not cryptographic.** A determined attacker who could write to the school's database could in principle fabricate a "valid" record. The system depended on the school's IT security being airtight.

### The pivot to Portable Badge

Portable Badge keeps EduSeal's three-state verification model — Verified, Tampered, Not Found — but rebuilds the rest of the architecture around two changes:

1. **Anchor proofs on a public blockchain instead of a private database.** Every issuance is recorded on the Stellar network via a Soroban smart contract. The record is immutable, public, and survives any single party going offline.
2. **Make the badge travel with the document.** A certificate page is appended directly to the PDF, with the BLAKE3 hash visible on it. The proof is in the file, not in a portal lookup. Recipients can keep, share, and store their documents like any other PDF — no platform dependency.

The result is a multi-school, cryptographically grounded credentialing network where:

- Schools issue, but the proof is portable
- Recipients own their documents outright
- Verifiers can confirm anything without contacting anyone

---

## Why Stellar?

The choice to anchor on Stellar specifically — rather than Ethereum, a generic proof-of-stake chain, or a private permissioned ledger — came down to four practical considerations:

**Cost.** Anchoring a hash on Stellar costs fractions of a cent. At institutional scale (a single school can issue thousands of documents per year), per-anchor cost matters. Ethereum mainnet would be 100–1000× more expensive; layer-2 chains add bridging and finality complexity.

**Speed.** Stellar finalizes transactions in roughly 5 seconds. The badge is on-chain before the issuer has finished closing the upload modal — no waiting room, no confirmation polling.

**Soroban smart contracts in Rust.** Our backend ([pb_engine/](../pb_engine/)) is already written in Rust. The Soroban contract ([pb_contract_stellar/](../pb_contract_stellar/)) shares that toolchain end-to-end — same language, same testing patterns, same deploy workflow. This kept the team small and the build process simple.

**Wallet UX.** Freighter, Stellar's official browser extension, offers a polished install-and-go experience for issuers. No mnemonic phrase rituals, no setup tutorials.

**Server-pays-gas model.** Issuers connect Freighter purely as an identity. The platform's own treasury wallet signs and pays for every on-chain anchor. Schools never need to hold or spend XLM directly to issue (though they do purchase credits in XLM — see [05-credits-and-wallet.md](05-credits-and-wallet.md)).

---

## How it works, end to end

A typical flow looks like this:

1. **Issuer connects** — A registrar at a partner school connects their Freighter wallet on the Portable Badge dashboard.
2. **Issuer uploads** — They drag in a source PDF (a diploma, say), enter the recipient's name and email, and click Upload.
3. **Engine processes** — The backend ([pb_engine/src/api/document_handler.rs](../pb_engine/src/api/document_handler.rs)):
   - Computes a BLAKE3 hash of the PDF bytes
   - Generates a new PDF with a certificate page appended (issuer details, recipient, hash, timestamp)
   - Calls the Soroban contract to anchor the hash on Stellar
   - Stores both the original and badged PDFs in the database
   - Emails the badged PDF to the recipient
4. **Recipient receives** — The student gets an email with the badged PDF attached and a link to the on-chain transaction.
5. **Verifier checks** — Anyone (employer, foreign university, government office) drops the PDF onto the public Verify page. Within a second they see Verified / Tampered / Not Found.

The whole flow takes about 5–10 seconds for the issuer; verification takes under a second.

---

## Who Portable Badge is for

| Stakeholder | What they do | What they read |
|---|---|---|
| Partner institutions | Issue authenticated documents | [02-partner-schools.md](02-partner-schools.md) |
| Recipients (students, employees) | Receive and share badged documents | [03-recipient-guide.md](03-recipient-guide.md) |
| Third-party verifiers | Confirm documents are real | [04-verifier-guide.md](04-verifier-guide.md) |
| Issuers managing credits | Top up XLM, monitor usage | [05-credits-and-wallet.md](05-credits-and-wallet.md) |

---

## Current status

Portable Badge is running on **Stellar testnet** while finalizing mainnet deployment. Testnet anchors are real and immutable, but they live on Stellar's test network rather than the production network. Mainnet migration is on the immediate roadmap.

**Active partner schools (initial system testing):**

- Holy Cross of Davao College (HCDC)
- University of the Immaculate Conception (UIC)
- Saint Peter's College of Toril (SPC-T)

**In partnership talks:**

- Davao Central College (DCC)

**Live deployed contract:**

- Network: Testnet (`Test SDF Network ; September 2015`)
- Contract ID: `CBDUVFTBSNECWY5B5VEWJ4FI5XIOX4SZNBEKW3W5RMSFEHLO725ZRNYG`
- Source: [pb_contract_stellar/](../pb_contract_stellar/)

See the top-level [README.md](../README.md) for full technical and deployment details.

---

## What Portable Badge is not

To set expectations clearly:

- **Not a record-keeping system.** We anchor proofs of *what was issued and when* — we don't replace your registrar's information system.
- **Not an identity verifier.** We confirm the document is real and unaltered. We don't confirm the person presenting it is who they claim to be.
- **Not a credential issuer ourselves.** We are infrastructure. The issuing institution is responsible for the academic, legal, or contractual content of every badge.
- **Not a closed garden.** Verification is free and public. There is no platform lock-in for recipients or third parties.

---

## What's next

Roadmap highlights (see [PITCH_DECK.md](../PITCH_DECK.md) for the full slide deck):

- Mainnet deployment
- Bulk issuance API (CSV → batch badge generation)
- QR code on the certificate page linking directly to the verify endpoint
- Issuer-initiated revocation (mark a badge as no longer valid on-chain)
- Public verification URL (share a link, no upload required)
- SDKs for LMS, HRMS, and legal-platform integration
