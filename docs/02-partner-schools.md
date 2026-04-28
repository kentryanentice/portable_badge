# Partner Schools — Onboarding & Issuer Guide

> Audience: Registrars, IT directors, and academic-records officers at partner institutions.
> If you are a recipient receiving a badged document, see [03-recipient-guide.md](03-recipient-guide.md).
> If you are a third party verifying a document, see [04-verifier-guide.md](04-verifier-guide.md).

---

## What partnership means

Portable Badge partners with academic institutions to give them **exclusive issuer status** on the platform. As a partner, your school is the only entity that can mint authentic Portable Badge certificates for documents under your name — diplomas, transcripts, certificates of completion, character references, or any PDF your registrar's office produces.

Every badge your school issues is:

- **Cryptographically bound** to the document's bytes via a BLAKE3 hash
- **Anchored on the Stellar blockchain** via our deployed Soroban smart contract
- **Independently verifiable** by anyone, anywhere, without contacting your office

This means the verification load on your registrar's office drops to near-zero. Employers, foreign universities, and government agencies can confirm a document's authenticity in seconds without phone calls or email chains.

---

## Current partners

| Institution | Status | Region |
|---|---|---|
| Holy Cross of Davao College (HCDC) | Active — initial system testing | Davao City |
| University of the Immaculate Conception (UIC) | Active — initial system testing | Davao City |
| Saint Peter's College of Toril (SPC-T) | Active — initial system testing | Davao City |
| Davao Central College (DCC) | In partnership talks | Davao City |

If your institution is interested in partnering, see [Becoming a partner](#becoming-a-partner) at the bottom of this page.

---

## How issuer identity works

Portable Badge uses **Freighter**, a Stellar wallet browser extension, to identify issuers. Each partner school registers one or more Stellar wallet addresses with us, and only those wallets can issue documents under the school's name.

**Why a wallet, not a username/password?**

- The wallet address is a public, cryptographic identity. It cannot be phished, reset by a forgotten-password flow, or socially engineered out of an admin assistant.
- Every document your school issues is signed by your wallet's identity at the smart-contract level, on-chain, with a permanent timestamp. No password-reset email can retroactively fake an issuance.
- Recipients and verifiers can confirm — directly on stellar.expert — that a given badge was issued by your registered wallet and no other.

**You do not need to hold or spend XLM to operate.** The platform pays the gas for every on-chain anchor. Your wallet is purely an identity, not a payment method (until you top up credits — see [Credits & billing](#credits--billing)).

---

## Onboarding checklist

Once your institution signs the partnership agreement, onboarding takes about 30 minutes.

### 1. Designate registrar wallet(s)

- Decide which staff members will issue documents (typically: head registrar, deputy registrar, records officer).
- Each issuing staff member installs the Freighter browser extension from [freighter.app](https://freighter.app) and creates a Stellar wallet.
- Send us each wallet's public address (begins with `G…`, 56 characters).

### 2. Issuer allowlist registration

We register your wallet addresses as authorised issuers for your institution. From this point on, any document issued from those wallets is automatically tagged as originating from your school.

### 3. Initial credits grant

Partners receive a starter grant of credits to cover initial system testing — typically enough for 50–100 documents, depending on whether email delivery is included. See [Credits & billing](#credits--billing) below.

### 4. Test issuance

Before going live with real student records, we walk your team through:

- Issuing one test document
- Verifying it as a third party would
- Inspecting the on-chain anchor on stellar.expert
- Performing a tamper test (modify the file, re-verify, see the **Tampered** result)

### 5. Go-live

Once your team is comfortable, you begin issuing real documents. Each issuance is irrevocable on-chain — please complete training before your first production batch.

---

## The issuer flow (day-to-day)

After onboarding, your registrar's daily workflow is:

1. **Open the Portable Badge dashboard** in any modern browser.
2. **Connect Freighter** — one click, no password.
3. **Go to Upload** — drag in the source PDF (a diploma, transcript, etc.).
4. **Fill in three fields:**
   - **Title** — what the document is (e.g. "Bachelor of Science in Computer Science — Diploma")
   - **Recipient** — the student's full name
   - **Email** — where the badged copy should be sent
5. **Click Upload.** The system:
   - Computes a BLAKE3 hash of the original PDF
   - Generates a new PDF with an embedded certificate page (Portable Badge branding, document details, the hash, an issuance timestamp)
   - Anchors the hash on the Stellar blockchain via our smart contract
   - Emails the badged PDF to the recipient
   - Downloads a copy to your computer for your records
6. **The badge is now permanent.** Even if Portable Badge's servers go offline, the on-chain record remains verifiable forever.

The whole flow takes about 5–10 seconds per document. Bulk issuance (CSV → batch) is on our v2 roadmap.

---

## What the recipient gets

The student receives an email containing:

- A copy of the badged PDF (their original document, with our certificate page appended as the last page)
- A short note explaining what Portable Badge is and how to verify the document
- A direct link to the on-chain transaction on stellar.expert

The recipient does **not** need a wallet, an account, or any technical knowledge to keep, share, or use their badged document. It is just a PDF.

---

## Credits & billing

Portable Badge uses a credit system to meter platform usage. Credits are purchased with **XLM** (Stellar's native token) through your school's registered wallet.

| Action | Credit cost |
|---|---|
| Upload a document (badge generation + on-chain anchor) | **20 credits** |
| Email the badged PDF to the recipient | **30 credits** |
| Verify a document (third parties) | **Free** |

So a typical issuance with email delivery costs **50 credits**. If your office prefers to distribute the badged PDFs yourselves, you can disable email delivery and pay only 20 credits per document.

**Refund policy:** If email delivery fails (e.g. invalid recipient address), the 30 email-credits are refunded automatically; the 20 upload-credits remain charged because the document is still successfully anchored on-chain.

**Top-up flow:** Visit the **Credits** page, pick a plan, and Freighter prompts you to send the corresponding XLM to our treasury wallet. Credits are added to your balance once the payment confirms (typically 5 seconds on Stellar).

**Pricing tiers:** Plans are listed on the Credits page in your dashboard. Volume-discounted plans are available for institutions issuing more than 1,000 documents per year — contact us for details.

---

## Security & compliance

- **Document storage:** The original PDF and the badged PDF are both stored in our PostgreSQL database, encrypted at rest. They are accessible only via your registered wallet's session. Other partner schools cannot see your documents.
- **No PII on-chain:** The Stellar anchor records only the BLAKE3 hash, your wallet address, the recipient's name and email, and the document title. The actual document bytes never leave our backend.
- **GDPR / Data Privacy Act of 2012 (PH):** Recipients can request deletion of their email and name from our database. The on-chain hash remains, but it is anonymised — a hash alone cannot be reversed to the document or the student.
- **Tamper proof:** Once a document is anchored, no one — not the student, not your registrar, not Portable Badge itself — can alter or delete the on-chain record. The first issuance is canonical, forever.

---

## Becoming a partner

If your institution would like to join the partner network:

1. Reach out via the contact form on the public site, or email the team directly (see project [README.md](../README.md)).
2. We schedule a 30-minute discovery call to understand your document volume, current verification process, and integration needs.
3. We provide a partnership agreement covering issuer exclusivity, data handling, and pricing.
4. Once signed, onboarding takes about a week (mostly waiting for your team to be available for the test issuance and training).

We currently focus on Davao-region institutions but are open to partners across the Philippines and Southeast Asia.
