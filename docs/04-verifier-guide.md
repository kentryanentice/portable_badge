# Verifier Guide

> Audience: Anyone who has received a PDF claiming to be a Portable Badge document and wants to confirm it is authentic. **No account, no wallet, no setup required.**

---

## What you'll get

When you drop a PDF onto the Verify page, Portable Badge tells you exactly one of three things:

| Result | Meaning |
|---|---|
| ✅ **Verified** | The document is **authentic** and **unmodified**. It matches a record issued by a registered partner institution. |
| ⚠️ **Tampered** | The document carries a Portable Badge certificate page, but its contents have been **altered** since it was issued. Even a single-byte change triggers this result. |
| ❌ **Not Found** | The document is not registered with Portable Badge. Either it was never badged, or the certificate page has been stripped out. |

Each result is shown alongside the document's original details (title, recipient, issuer, issuance date, on-chain transaction).

---

## How to verify a document

### Step 1 — Open the Verify page

Go to the Portable Badge website and click **Verify** in the navigation. You do not need to log in or connect a wallet.

### Step 2 — Drop the PDF

Drag the PDF onto the upload area, or click to browse. The file is uploaded to our server, hashed, and checked against our registry. **The file is not stored** during verification — only the hash is computed and looked up.

### Step 3 — Read the result

Within a second, you will see one of the three states above with full details if available.

---

## Understanding each result

### ✅ Verified

The PDF you uploaded matches — byte-for-byte — a document that was issued through Portable Badge by a registered partner institution. You can trust:

- **Who issued it** — the partner institution's name and Stellar wallet address
- **When it was issued** — the original issuance timestamp
- **What it claims to be** — title, recipient name, recipient email
- **That it has not been modified** — not a single byte has changed since issuance

The page also shows a link to the **on-chain transaction** on stellar.expert. You can click through to see the issuance recorded permanently on the Stellar blockchain — an independent proof that does not rely on Portable Badge's servers being online.

### ⚠️ Tampered

The PDF claims to be a Portable Badge document — we can see our certificate page embedded in it — but its hash does not match any record we have. **This means the file was modified after it was issued.**

This is a critical distinction from "Not Found." It means someone:

- Started with a real, badged document
- Made changes to it (changed a name, a date, a grade, a signature, anything)
- Left the certificate page in place, hoping the modification would go unnoticed

Treat a **Tampered** result as a strong signal of attempted fraud. Do not accept the document. If you can identify the issuing institution from the certificate page, contact their registrar's office.

### ❌ Not Found

The PDF has no detectable Portable Badge certificate page, and no matching record exists in our registry. This means one of:

- The document was **never registered** with Portable Badge
- The document was issued through a different system entirely
- Someone removed the certificate page from a previously-badged document (in which case it is no longer verifiable)

A "Not Found" result does **not** automatically mean the document is fake — it just means we cannot confirm it. Verify through the issuing institution by other means (phone, email, official transcript request).

---

## What if the result is wrong?

### "I know this document is real, but I'm getting Tampered"

The most common cause: the file was re-saved by a PDF editor (Preview, Adobe Acrobat, even some browsers) which silently re-wrote the bytes — even though the visible content looks identical. Re-savings change byte-level content like compression, metadata, and object ordering, which produces a different hash.

**Fix:** Ask the recipient or issuer for the original file as it was emailed to them. Do not open and re-save the PDF before verifying.

### "I know this document is real, but I'm getting Not Found"

Possible causes:

- The certificate page was removed (intentionally or by a PDF editor that drops appended pages).
- The document was issued by an institution not currently using Portable Badge.
- You are verifying a screenshot or printout of the document, not the PDF itself. Verification only works on the original digital file.

### "The result is Verified, but the recipient's email/name looks wrong"

The on-chain record is the source of truth. If the recipient name on the Verified page does not match the person presenting the document, that is grounds for further investigation — Portable Badge confirms the document is unaltered, but it cannot confirm the document was given to the right person at issuance time.

---

## What Portable Badge does and does not prove

**Verified means:**

- ✅ The PDF is byte-identical to what the issuer registered
- ✅ The issuer was a wallet authorised at issuance time
- ✅ The issuance timestamp is accurate (anchored on Stellar)

**Verified does not mean:**

- ❌ That the issuing institution is reputable (we do not vet partner schools' actual academic standards)
- ❌ That the issuer was authorised to issue this specific document (the issuer's own internal controls govern that)
- ❌ That the recipient is who they say they are at the moment they show you the document

For most use cases — confirming a diploma is real, a contract has not been altered, a certificate is not forged — **Verified gives you exactly what you need**: cryptographic certainty that the document in your hands is the document the issuer registered.

---

## FAQ

**Do I need a Stellar wallet to verify?**
No. Verification is completely free and requires no account, wallet, or technical setup.

**Is my upload private?**
Yes. We compute a hash and look it up. The PDF bytes are not stored, logged, or analysed beyond the hash computation.

**How long does verification take?**
Typically under one second. Larger PDFs (50+ MB) may take a few seconds longer.

**What's the maximum file size?**
50 MB. If your file is larger, contact the issuer for a smaller version.

**Can I verify a document offline?**
Not yet. The verification step requires checking the hash against our registry and the Stellar blockchain. A self-contained offline verifier is on our roadmap.

**Can I verify many documents in bulk?**
Bulk verification (CSV upload, API access) is on our v2 roadmap. For now, please verify one document at a time.

**The on-chain link goes to a "testnet" page — what does that mean?**
We are currently running on the Stellar **testnet** while finalising mainnet deployment. Testnet anchors are real, immutable, and verifiable, but they live on Stellar's test network rather than the production network. Mainnet migration is planned for the next release.

**Who do I contact if I think a document is fraudulent?**
First, contact the issuing institution directly — they have the strongest interest in stopping fraud against their credentials. You can also report suspected abuse to the Portable Badge team via the contact form on our public site.
