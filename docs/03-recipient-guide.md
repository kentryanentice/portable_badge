# Recipient Guide

> Audience: Students, graduates, employees, or anyone who has received a Portable Badge document by email from a partner institution. **You don't need a wallet, an account, or any technical setup.**

---

## What you just received

If a partner institution (your school, employer, or another issuer) sent you a Portable Badge document, you should have an email with:

- A **PDF attachment** — your original document with a certificate page appended at the end
- A **link to the on-chain transaction** — proof that your document was registered on the Stellar blockchain at issuance
- A short note explaining what Portable Badge is

The PDF itself is your document. **Treat it like any other important PDF** — save it to your cloud drive, keep a copy on your computer, share it with employers or universities the same way you'd share a regular diploma scan.

---

## What's different about a Portable Badge document

Compared to a regular PDF, your badged document has one extra thing: an additional page at the end called the **Portable Badge Verification Certificate**. It looks like this:

- A dark navy header with "PORTABLE BADGE" and "Document Verification Certificate"
- Your **document title**, your **name**, your **email**, and the **issuance date**
- A long string of letters and numbers labeled **BLAKE3 VERIFICATION HASH** — this is the cryptographic fingerprint of your document
- A footer noting the document is verified on-chain

This page is what makes your document tamper-evident. Anyone — an employer, another university, a government agency — can drop your PDF onto our [Verify page](04-verifier-guide.md) and confirm it's the real thing in under a second.

---

## What you should do (and shouldn't do) with the file

### ✅ Do

- **Save the PDF as it was emailed to you.** This is the canonical, verified copy.
- **Share it as-is.** Email it, attach it to applications, upload it to job portals.
- **Keep a backup.** Cloud storage, USB drive, anywhere safe.
- **Print it if needed.** A printed copy is fine for in-person presentations, but only the digital file is verifiable.

### ❌ Don't

- **Don't open and re-save the PDF in a PDF editor.** Programs like Adobe Acrobat, Preview (macOS), or some browsers may rewrite the file's bytes when saving — even if the content looks identical. Re-saving changes the cryptographic hash and will cause verification to fail with a **Tampered** result.
- **Don't crop, merge, or split the PDF.** Removing the certificate page (the last page) makes the document unverifiable.
- **Don't convert it to other formats** (Word, JPG, etc.) and then back to PDF. The hash will change.
- **Don't sign or annotate it** unless absolutely necessary. Adding a digital signature, comment, or watermark modifies the bytes.

If you need to make any changes (e.g. fill in a form field, add a personal signature), keep an unmodified copy of the original — that is the version you share for verification.

---

## How to verify your own document

You can confirm your own document is registered correctly. This is useful right after you receive it, just to make sure everything went through:

1. Go to the public Verify page (link in your email, or visit Portable Badge's main site and click **Verify**)
2. Drag the PDF onto the upload area
3. You should see a green ✅ **Verified** badge with your details

If you see **Tampered** or **Not Found**, see [Troubleshooting](#troubleshooting) below — but if the file came directly from the issuance email, this is very unlikely.

---

## How third parties verify your document

When you submit your badged PDF for a job, scholarship, university application, or any official process, the recipient on the other end can verify it themselves:

1. They go to the public Verify page (no login needed)
2. They drop your PDF onto the page
3. They see ✅ Verified along with: your name, email, document title, issuance date, and a link to the on-chain transaction

That's it. No phone call to your school. No "wait two weeks for transcript verification." No paperwork. They have cryptographic proof of authenticity in under a second.

You can include a short line in your application emails like:

> *This document is issued via Portable Badge and can be verified at [verify URL]. Drop the PDF onto the page for instant on-chain confirmation.*

---

## What happens to your data

Privacy details, in plain language:

- **Your name, email, and the document title are stored on Stellar's blockchain.** This is part of how the badge is anchored — without these, third-party verifiers couldn't see who the document was issued to. The blockchain record is permanent and public.
- **The document itself is NOT on the blockchain.** Only its cryptographic hash. The actual PDF bytes never leave the issuer's database and our backend.
- **Your email is used only to send you the badged document.** We don't market to you, and we don't share it.
- **You can request deletion of your name and email from our database.** The on-chain hash will remain (it has to — that's what makes verification possible), but it's a meaningless string of characters without context. Contact your issuing institution to start a deletion request.

---

## Troubleshooting

### The verifier says "Tampered" but I haven't changed the file

The most common cause is accidental re-saving. Some apps modify a PDF's bytes when you "save" or "save as," even if the visible content is identical. Likely culprits:

- macOS Preview ("Save" or "Export")
- Adobe Acrobat (any save action)
- Browser PDF viewers with a download button
- Email apps that "convert" attachments

**Fix:** Find your original copy from the email and use that one. If you no longer have it, contact your issuing institution and ask for a re-issuance — they have a record and can resend the original badged file.

### The verifier says "Not Found"

This usually means either:

- The certificate page was removed (the last page of the PDF must be present)
- A different PDF was uploaded (e.g. an unrelated file, or a printout-then-rescan, which becomes a new file with a different hash)
- You're trying to verify a screenshot or image of the document, not the PDF itself

**Fix:** Make sure you're verifying the original PDF you received, with all pages intact.

### I lost the badged PDF

Contact your issuing institution. They store both the original and badged copies. They can resend the file to your email — the hash and the on-chain record are unchanged, so the resent file will verify identically to the original.

### I need to update my name or email on the document

The on-chain record is permanent and cannot be edited. If your name or email needs to change, the issuer must issue a new badge with corrected details. The old one will still verify (with the old details); the new one will be the one you should use going forward.

### Someone says they verified my document and got "Tampered" — but I didn't tamper with it

Two possibilities:

1. They downloaded a re-saved copy (see the first troubleshooting item) and need the original.
2. Someone in the chain (a recipient who forwarded the file, an email server that re-encoded it, etc.) modified the bytes inadvertently.

Send them a fresh copy from your saved original. If the issue persists, contact your issuing institution.

---

## Frequently asked questions

**Do I need a Stellar wallet to receive or use this?**
No. You don't need any account, wallet, or technical knowledge. The PDF is yours; that's all you need.

**Will my badged PDF expire?**
The badge does not expire. The cryptographic hash and on-chain record are permanent. As long as you have the original PDF file, it will verify forever (or until Stellar itself shuts down — which, for a public blockchain, is essentially never).

**What if Portable Badge goes out of business?**
The on-chain record on Stellar remains verifiable independently via stellar.expert (a public block explorer). The certificate page on your PDF includes the hash and references the contract — meaning even without our website, the proof exists.

**Can I use my badged PDF in another country?**
Yes. Verification is global, free, and requires no setup. Anyone with internet access can verify it.

**Is this the same as a digital signature?**
Different concept. A digital signature (PKI-based) confirms the *signer's* identity. Portable Badge confirms the *document's* identity — that the bytes match what was issued. Both are valuable; neither replaces the other.

**Can I edit my badged PDF?**
You can keep a copy and edit it, but the edited version will fail verification (it will show as Tampered). Always preserve an untouched original for any verification scenarios.

**Is the on-chain link safe to share?**
Yes. The Stellar transaction page (stellar.expert) is public and read-only. Sharing the link lets verifiers see the on-chain proof directly, which strengthens trust.
