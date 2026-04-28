import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFreighter } from '../providers/FreighterProvider'
import { EXPLORER_TX } from '../lib/contract'

type Doc = {
    id: string
    file: File
    name: string
    title: string
    email: string
}

type Result = {
    title:        string
    recipient:    string
    blake3_hash:  string
    stellar_hash: string
    ok:           boolean
    reason:       string
}

const PAGE_SIZE = 3

function Upload() {
    const { address }        = useFreighter()
    const [docs, setDocs]    = useState<Doc[]>([])
    const [drag, setDrag]    = useState(false)
    const [page, setPage]    = useState(0)
    const [balance, setBalance] = useState<number | null>(null)
    const [uploadCost, setUploadCost] = useState<number>(50)
    const [creditsToast, setCreditsToast] = useState<string | null>(null)
    const inputRef           = useRef<HTMLInputElement>(null)
    const listRef            = useRef<HTMLDivElement>(null)

    const ENGINE = import.meta.env.VITE_API_URL

    useEffect(() => {
        if (!address) { setBalance(null); return }
        const ctrl = new AbortController()
        fetch(`${ENGINE}/credits/balance`, {
            headers: { 'x-wallet': address },
            signal:  ctrl.signal,
        })
            .then(r => r.ok ? r.json() : null)
            .then((data: { balance: number, upload_cost: number } | null) => {
                if (data) {
                    setBalance(data.balance)
                    setUploadCost(data.upload_cost)
                }
            })
            .catch(() => {})
        return () => ctrl.abort()
    }, [ENGINE, address])

    const addFiles = (files: FileList | null) => {
        if (!files) return
        const pdfs = Array.from(files).filter(f => f.type === 'application/pdf')
        setDocs(prev => [
            ...prev,
            ...pdfs.map(file => ({
                id: crypto.randomUUID(),
                file,
                name: '',
                title: file.name.replace(/\.pdf$/i, ''),
                email: '',
            }))
        ])
    }

    const update = (id: string, field: 'name' | 'title' | 'email', value: string) =>
        setDocs(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))

    const remove = (id: string) =>
        setDocs(prev => prev.filter(d => d.id !== id))

    const [uploading, setUploading] = useState(false)
    const [results, setResults]     = useState<Result[]>([])

    const totalPages = Math.ceil(docs.length / PAGE_SIZE)
    const readyCount = docs.filter(d => d.name && d.title && d.email).length

    const handleUpload = async () => {
        if (!address) return

        // Pre-flight: stop here if balance is known to be insufficient.
        // Each upload costs `uploadCost` (typically 20, or 50 if mailer enabled).
        const ready = docs.filter(d => d.name && d.title && d.email)
        const needed = ready.length * uploadCost
        if (balance !== null && balance < needed) {
            setCreditsToast(
                balance === 0
                    ? `You have no credits. ${needed} needed for ${ready.length} document${ready.length === 1 ? '' : 's'} (${uploadCost} each).`
                    : `Only ${balance} credit${balance === 1 ? '' : 's'} left, but ${needed} needed (${uploadCost} per upload).`,
            )
            return
        }

        setUploading(true)
        setResults([])
        setCreditsToast(null)
        const out: Result[] = []
        let consumed = 0
        let outOfCredits = false

        for (const doc of ready) {
            if (outOfCredits) {
                out.push({ title: doc.title, recipient: doc.name, blake3_hash: '', stellar_hash: '', ok: false, reason: 'Skipped — out of credits' })
                continue
            }

            const fd = new FormData()
            fd.append('file', doc.file)
            fd.append('title', doc.title)
            fd.append('recipient', doc.name)
            fd.append('email', doc.email)
            try {
                const res = await fetch(`${ENGINE}/document`, {
                    method: 'POST',
                    headers: { 'x-wallet': address },
                    body: fd,
                })
                if (!res.ok) {
                    if (res.status === 402) {
                        outOfCredits = true
                        out.push({ title: doc.title, recipient: doc.name, blake3_hash: '', stellar_hash: '', ok: false, reason: 'Insufficient credits' })
                        continue
                    }
                    const reason =
                        res.status === 409 ? 'Already registered' :
                        res.status === 401 ? 'Wallet not connected' :
                        res.status === 400 ? 'Invalid request' :
                        res.status === 413 ? 'File too large' :
                        'Server error'
                    out.push({ title: doc.title, recipient: doc.name, blake3_hash: '', stellar_hash: '', ok: false, reason })
                    continue
                }

                const hash         = res.headers.get('x-blake3-hash')   ?? ''
                const stellar_hash = res.headers.get('x-stellar-hash')  ?? ''
                const stellarErr   = res.headers.get('x-stellar-error') ?? ''
                const blob         = await res.blob()
                const url          = URL.createObjectURL(blob)
                const a            = document.createElement('a')
                a.href             = url
                a.download         = `badge_${doc.title.replace(/ /g, '_')}.pdf`
                a.click()
                URL.revokeObjectURL(url)

                consumed += 1
                out.push({
                    title: doc.title,
                    recipient: doc.name,
                    blake3_hash: hash,
                    stellar_hash,
                    ok: true,
                    reason: stellarErr ? `Saved off-chain. Anchor failed: ${stellarErr}` : '',
                })
            } catch {
                out.push({ title: doc.title, recipient: doc.name, blake3_hash: '', stellar_hash: '', ok: false, reason: 'Network error' })
            }
        }

        if (consumed > 0) {
            setBalance(b => (b === null ? null : Math.max(0, b - consumed * uploadCost)))
        }
        if (outOfCredits) {
            const remaining = ready.length - consumed
            setCreditsToast(
                `Ran out of credits — ${consumed} uploaded, ${remaining} skipped. Buy more to continue.`,
            )
        }

        setResults(out)
        setUploading(false)
        setDocs(prev => prev.filter(d => !(d.name && d.title && d.email)))
    }

    const handleReset = () => setResults([])

    const handleScroll = () => {
        const el = listRef.current
        if (!el || !docs.length) return
        const cardW = el.scrollWidth / docs.length
        setPage(Math.min(Math.round(el.scrollLeft / (cardW * PAGE_SIZE)), totalPages - 1))
    }

    return (
        <div className="upload">

            <div className="upload-header">
                <div>
                    <h1 className="upload-title">Upload Documents</h1>
                    <p className="upload-subtitle">Upload PDF documents to issue portable badges. Each upload uses 50 credits.</p>
                </div>
                {address && balance !== null && (
                    <Link to="/credits" className={`upload-balance${balance === 0 ? ' upload-balance--empty' : ''}`}>
                        <i className="bx bx-wallet" />
                        <span>{balance} credit{balance === 1 ? '' : 's'}</span>
                    </Link>
                )}
            </div>

            {creditsToast && (
                <div className="upload-toast upload-toast--warn">
                    <i className="bx bx-error" />
                    <div className="upload-toast-body">
                        <strong>Insufficient credits.</strong> {creditsToast}
                        <Link to="/credits" className="upload-toast-link">Buy credits →</Link>
                    </div>
                    <button className="upload-toast-close" onClick={() => setCreditsToast(null)}>
                        <i className="bx bx-x" />
                    </button>
                </div>
            )}

            <div
                className={`upload-zone${docs.length ? ' compact' : ''}${drag ? ' drag' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
            >
                <input ref={inputRef} type="file" accept=".pdf" multiple hidden onChange={e => addFiles(e.target.files)} />
                {docs.length > 0 ? (
                    <>
                        <i className="bx bx-plus" />
                        <span>Add more PDFs</span>
                    </>
                ) : (
                    <>
                        <i className="bx bx-cloud-upload" />
                        <p>Drop PDFs here or <span>browse files</span></p>
                        <small>PDF only · Multiple files supported</small>
                    </>
                )}
            </div>

            {docs.length > 0 && (
                <>
                    <div className="upload-list" ref={listRef} onScroll={handleScroll}>
                        {docs.map(doc => {
                            const ready = !!(doc.name && doc.title && doc.email)
                            const warn  = !!(doc.name || doc.title || doc.email) && !ready
                            return (
                                <div key={doc.id} className="upload-item">
                                    <div className="upload-item-head">
                                        <div className="upload-file">
                                            <i className="bx bxs-file-pdf" />
                                            <span>{doc.file.name}</span>
                                        </div>
                                        <div className="upload-item-actions">
                                            <span className={`upload-status${ready ? ' ready' : warn ? ' warn' : ''}`}>
                                                <i className={`bx ${ready ? 'bx-check' : warn ? 'bx-error' : 'bx-minus'}`} />
                                            </span>
                                            <button className="upload-remove" onClick={() => remove(doc.id)}>
                                                <i className="bx bx-x" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="upload-item-fields">
                                        <input
                                            className="upload-input"
                                            placeholder="Recipient name"
                                            value={doc.name}
                                            onChange={e => update(doc.id, 'name', e.target.value)}
                                        />
                                        <input
                                            className="upload-input"
                                            placeholder="Document title"
                                            value={doc.title}
                                            onChange={e => update(doc.id, 'title', e.target.value)}
                                        />
                                        <input
                                            className="upload-input"
                                            placeholder="Email address"
                                            type="email"
                                            value={doc.email}
                                            onChange={e => update(doc.id, 'email', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {totalPages > 1 && (
                        <div className="upload-pagination">
                            {Array.from({ length: totalPages }).map((_, i) => (
                                <span key={i} className={`upload-dot${i === page ? ' active' : ''}`} />
                            ))}
                        </div>
                    )}

                    <div className="upload-footer">
                        <span className="upload-summary">{readyCount} of {docs.length} ready</span>
                        <button className="upload-submit" disabled={readyCount === 0 || uploading || !address} onClick={handleUpload}>
                            <i className={`bx ${uploading ? 'bx-loader-alt spin' : 'bx-send'}`} />
                            <span>{uploading ? 'Uploading & anchoring...' : `Upload ${docs.length} document${docs.length > 1 ? 's' : ''}`}</span>
                        </button>
                    </div>
                </>
            )}

            {results.length > 0 && (
                <div className="upload-results">
                    <div className="upload-results-header">
                        <span>{results.filter(r => r.ok).length} of {results.length} uploaded</span>
                        <button className="upload-results-close" onClick={handleReset}>
                            <i className="bx bx-x" />
                        </button>
                    </div>
                    {results.map((r, i) => (
                        <div key={i} className={`upload-result${r.ok ? '' : r.reason === 'Already registered' ? ' upload-result--duplicate' : ' upload-result--error'}`}>
                            <span className="upload-result-icon">
                                <i className={`bx ${r.ok ? 'bx-check-circle' : r.reason === 'Already registered' ? 'bx-copy' : 'bx-x-circle'}`} />
                            </span>
                            <div className="upload-result-info">
                                <span className="upload-result-title">{r.title}</span>
                                <span className="upload-result-meta">
                                    {r.ok
                                        ? r.stellar_hash
                                            ? <>{r.recipient} · <a href={EXPLORER_TX(r.stellar_hash)} target="_blank" rel="noreferrer">on-chain</a></>
                                            : r.reason || r.recipient
                                        : r.reason}
                                </span>
                            </div>
                            {r.ok && r.blake3_hash && (
                                <span className="upload-result-hash" title={r.blake3_hash}>
                                    {r.blake3_hash.slice(0, 12)}…
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

        </div>
    )
}

export default Upload
