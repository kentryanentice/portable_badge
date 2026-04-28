# Portable Badge — Pitch Deck

---

## 1. Cover

# Portable Badge

### Cryptographic Document Verification, Anchored On-Chain

*Any PDF. Any recipient. Tamper-proof — forever.*

---

## 2. The Problem

### Document Fraud Is Invisible Until It's Too Late

- Fake diplomas, forged contracts, and altered certificates are visually indistinguishable from genuine ones.
- Verification today still relies on phone calls, email chains, and institutional trust — slow, costly, and easy to spoof.
- Once a PDF leaves the issuer's hands, there is no way to prove it hasn't been changed.
- No open, portable standard exists for attaching proof-of-authenticity to a document.

In the Davao region alone, registrar offices field thousands of verification requests a year — most of them manual.

---

## 3. The Origin: From EduSeal to Portable Badge

We started as **EduSeal** — a school-registrar verification tool built around a single institution at a time. It worked, but it had three architectural limits:

1. **Centralized.** Proof lived only in each school's own database.
2. **Per-school.** Every partner needed its own deployment and verifier portal.
3. **Trust-based.** Anyone with database access could fabricate a "valid" record.

**Portable Badge keeps EduSeal's three-state verification model** — Verified, Tampered, Not Found — and rebuilds the rest:

- Proofs are anchored on a public blockchain, not a private database.
- Every badge travels with the document — the proof is in the file itself.
- Verifiers don't need an account, a portal, or a phone call.

---

## 4. The Solution

### The Proof Lives Inside the Document

We append a cryptographic certificate page directly to your PDF — so the badge travels with the file, not in a separate database lookup.

**Three core properties:**

1. **Self-contained** — verification data is inside the PDF itself.
2. **Tamper-evident** — any modification, even a single byte, is detectable.
3. **On-chain** — every issuance is permanently anchored to the Stellar blockchain.

---

## 5. How It Works

### Three Steps. No New Tools Required.

**Issue.**
Upload a PDF + recipient name + email. Portable Badge generates a badged copy with a certificate page, anchors the hash on Stellar, downloads the file, and emails the recipient.

**Distribute.**
Send the badged PDF like any normal file — email, cloud storage, USB drive, hand-delivered.

**Verify.**
Anyone drops the PDF onto the public Verify page and gets one of three results in under a second:

- ✅ **Verified** — authentic and unmodified
- 🔴 **Tampered** — badge present, but the file has been altered
- 🟡 **Not Found** — no badge detected; never registered

---

## 6. The Certificate Page

### Human-Readable. Machine-Verifiable.

Each badged PDF carries an appended certificate page containing:

- Document title and recipient information
- Issuance timestamp
- BLAKE3 cryptographic hash of the original document
- "Verified by Portable Badge" footer with on-chain reference

The page is rendered at the byte level using lopdf — no external editor, no third-party metadata that can be stripped or spoofed.

---

## 7. Three-State Verification

### Most Systems Tell You Yes or No. We Tell You *Why*.

| State | What It Means | How We Detect It |
|-------|--------------|-----------------|
| ✅ Verified | Hash matches a registered record | BLAKE3 hash found in registry |
| 🔴 Tampered | Badge present, hash mismatch | Badge markers present in raw PDF bytes; no matching record |
| 🟡 Not Found | No badge markers detected | Raw byte scan finds no badge; no record |

The Tampered/Not-Found distinction matters: it's the difference between **proving an attempt to deceive** and **simply lacking a record**.

---

## 8. Technical Architecture

### Production-Grade Stack, Built for Speed and Security

```
┌─────────────────────────────────────────────────────┐
│                   pb_frontend                        │
│       React · TypeScript · Freighter Wallet API      │
│   Upload ─── Documents ─── Verify ─── Credits        │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS / REST · x-wallet header
┌────────────────────▼────────────────────────────────┐
│                   pb_engine                          │
│              Rust · Axum · lopdf                     │
│  Rate limiting · Concurrency control · CORS          │
│  BLAKE3 hashing · Badge page generation              │
│  Soroban contract invocation (server-signed)         │
└────────┬──────────────────────────┬─────────────────┘
         │                          │
┌────────▼────────┐      ┌──────────▼────────────┐
│   PostgreSQL    │      │   Stellar / Soroban    │
│ Document store  │      │   Rust smart contract  │
│ Hash registry   │      │   On-chain badge log   │
└─────────────────┘      └───────────────────────┘
```

---

## 9. Why Stellar

### Permanent, Decentralized Proof — at Institutional Cost

**Soroban smart contract:**

- Anchors a `Badge` entry on-chain: issuer address, owner address, BLAKE3 hash, timestamp.
- Emits an `issued` event carrying recipient, email, and title for off-chain indexers.
- Persistent storage with automatic 1-year TTL extension on every issuance.
- Duplicate-hash guard prevents the same document from being anchored twice.

**Why Stellar specifically:**

- **Soroban writes Rust** — same language as our backend; one toolchain end-to-end.
- **Fractions of a cent per anchor** — viable at institutional scale.
- **5-second finality** — the badge is on-chain before the upload modal closes.
- **Mature wallet UX** — Freighter is a polished, drop-in browser extension.
- **Server-signed model** — the platform pays gas; issuers connect a wallet purely for identity.

Even if Portable Badge's servers go offline, the on-chain record remains verifiable forever via stellar.expert.

---

## 10. Security Model

### Security by Design, Not by Policy

**BLAKE3 hashing**

- 256-bit output — collision resistance equivalent to SHA-3.
- ~10× faster than SHA-256; processes a 10 MB PDF in under 1 ms.
- Deterministic: identical files → identical hashes; any change → completely different hash.

**Tamper detection**

- Raw byte scan for proprietary badge markers before querying the database.
- A document carrying a badge but failing hash verification is flagged as **Tampered**, not merely "not found."

**On-chain integrity**

- Soroban's resource model prevents badge entries from being overwritten or silently mutated.
- The contract enforces a single-write-per-hash rule — first anchor is canonical.

**Infrastructure**

- Rate limiting: 1,000 requests / 60 seconds.
- Concurrency limiting: 20 simultaneous requests.
- CORS, HSTS, CSP, X-Frame-Options, Referrer-Policy enforced at the server layer.

---

## 11. Live Partners

### Already in Production Testing with Davao-Region Institutions

| Institution | Status |
|---|---|
| Holy Cross of Davao College (HCDC) | Active — initial system testing |
| University of the Immaculate Conception (UIC) | Active — initial system testing |
| Saint Peter's College of Toril (SPC-T) | Active — initial system testing |
| Davao Central College (DCC) | In partnership talks |

Partner schools become exclusive issuers under their institutional name, with registered Stellar wallets functioning as cryptographic identities. Every document issued is signed by an authorized wallet and permanently traceable on-chain.

---

## 12. The Credit Model

### Schools Pay in XLM — Recipients and Verifiers Pay Nothing

| Action | Cost |
|---|---|
| Upload + on-chain anchor | 20 credits |
| Email delivery to recipient | 30 credits |
| Verification (any third party) | Free |

A typical issuance with email delivery costs 50 credits. Schools top up via Freighter — Stellar transaction confirms in ~5 seconds, credits land instantly.

If email delivery fails, the email portion is automatically refunded. The upload portion remains charged because the on-chain anchor still succeeded.

Volume-discounted plans are available for institutions issuing 1,000+ documents per year.

---

## 13. Live Demo

### Ninety Seconds, Seven Steps

1. **Connect** — Click "Connect Freighter" → wallet address shown in the dashboard.
2. **Upload** — Drop a PDF, fill in recipient + email, click Upload → badged PDF downloads with on-chain link.
3. **Inspect** — Open the downloaded PDF — certificate page appended. Click on-chain link → stellar.expert shows the live transaction.
4. **Verify (Verified)** — Drop the downloaded PDF onto the Verify page → green Verified badge.
5. **Tamper** — Open the PDF in a hex editor, change one byte, save.
6. **Verify (Tampered)** — Drop the modified PDF → red Tampered.
7. **Unknown** — Drop a random unregistered PDF → amber Not Found.

The ah-ha moment is step 5→6: a single-byte change is caught immediately, and the on-chain anchor proves the original was never the modified version.

---

## 14. Use Cases Beyond Education

### Any Industry That Issues PDFs Has This Problem

| Sector | Example |
|--------|---------|
| **Education** | Diplomas, transcripts, course certificates |
| **Legal** | Signed contracts, notarized affidavits, court documents |
| **HR & Recruiting** | Employment letters, references, background-check results |
| **Healthcare** | Prescriptions, lab reports, insurance pre-authorizations |
| **Finance** | Audit reports, compliance certifications, financial statements |
| **Government** | Permits, licenses, official correspondence |

All of these are already distributed as PDFs. Portable Badge requires zero workflow change for the recipient — they receive a PDF the same way they always did.

---

## 15. Competitive Landscape

### The Only Solution That Makes the Proof Portable

| | Portable Badge | Blockchain cert platforms | DocuSign / e-sign | Manual verification |
|-|:-:|:-:|:-:|:-:|
| Proof travels with the file | ✅ | ❌ | ❌ | ❌ |
| Works on any PDF viewer | ✅ | ❌ | ❌ | ✅ |
| Tamper vs. unregistered distinction | ✅ | ❌ | ❌ | ❌ |
| On-chain anchoring | ✅ | ✅ | ❌ | ❌ |
| Sub-cent per-issuance cost | ✅ | ❌ | ❌ | ✅ |
| No recipient app required | ✅ | ❌ | ❌ | ✅ |

---

## 16. Roadmap

### Built for Today, Designed to Scale

**Shipped (v1):**

- Badge generation and PDF embedding
- Three-state verification (Verified / Tampered / Not Found)
- Stellar testnet anchoring via Soroban smart contract
- Freighter wallet integration for issuer identity
- Document management dashboard
- Email delivery with credit-refund on failure
- Public verify page (no wallet required)

**Next (v2):**

- Stellar **mainnet** deployment with multi-issuer registry contract
- Bulk issuance API (CSV → batch badge generation)
- QR code on the certificate page linking directly to verify
- Issuer-initiated revocation — invalidate a badge on-chain

**Future:**

- SDKs for LMS, HRMS, and legal-platform integration
- Cross-issuer trust graph — institutions endorse each other on-chain
- Public verification URL — share a link, no upload required

---

## 17. Closing

### Documents Should Be Self-Proving

> A PDF is just bytes. A BLAKE3 hash of those bytes is a fingerprint. Embed the fingerprint in the document, anchor it on Stellar, and any PDF becomes its own certificate of authenticity.

**What we built:**

- A full-stack document verification platform in Rust + React
- A live Soroban smart contract on Stellar testnet
- A tamper-detection engine that distinguishes *modified* from *unregistered*
- Server-signed on-chain anchoring — issuers connect Freighter, the platform pays the gas
- Zero-friction UX — no wallet required to verify

**The ask:**

- Feedback on the tamper-detection approach
- Connections to institutions with high document-fraud exposure
- Interest in a pilot integration

**Thank you.**

— *Portable Badge*
