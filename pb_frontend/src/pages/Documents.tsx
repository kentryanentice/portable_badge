import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFreighter } from '../providers/FreighterProvider'
import { EXPLORER_TX } from '../lib/contract'
import Modal from '../elements/Modal'

type Doc = {
    id:           string
    title:        string
    recipient:    string
    email:        string
    blake3_hash:  string
    stellar_hash: string | null
    created_at:   string
}

type ListResponse = {
    items:    Doc[]
    total:    number
    page:     number
    per_page: number
}

const ENGINE   = import.meta.env.VITE_API_URL
const PER_PAGE = 10

function truncHash(h: string) {
    return `${h.slice(0, 10)}…${h.slice(-8)}`
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function pageList(page: number, totalPages: number): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const out: (number | '…')[] = [1]
    const start = Math.max(2, page - 1)
    const end   = Math.min(totalPages - 1, page + 1)
    if (start > 2) out.push('…')
    for (let i = start; i <= end; i++) out.push(i)
    if (end < totalPages - 1) out.push('…')
    out.push(totalPages)
    return out
}

function Documents() {
    const { address }             = useFreighter()
    const [docs, setDocs]         = useState<Doc[] | null>(null)
    const [total, setTotal]       = useState(0)
    const [page, setPage]         = useState(1)
    const [error, setError]       = useState(false)
    const [lastAddr, setLastAddr] = useState<string | null | undefined>(address)
    const [selected, setSelected] = useState<Doc | null>(null)

    if (lastAddr !== address) {
        setLastAddr(address)
        setDocs(null)
        setTotal(0)
        setPage(1)
        setError(false)
    }

    useEffect(() => {
        if (!address) return
        const ctrl = new AbortController()
        fetch(`${ENGINE}/documents?page=${page}&per_page=${PER_PAGE}`, {
            headers: { 'x-wallet': address },
            signal: ctrl.signal,
        })
            .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<ListResponse> })
            .then(data => { setDocs(data.items); setTotal(data.total) })
            .catch(e => { if (e.name !== 'AbortError') setError(true) })
        return () => ctrl.abort()
    }, [address, page])

    const loading    = docs === null && !error && !!address
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

    return (
        <div className="documents">

            <div className="documents-header">
                <div>
                    <h1 className="documents-title">Documents</h1>
                    <p className="documents-subtitle">All issued badges and their details.</p>
                </div>
                {total > 0 && (
                    <span className="documents-count">{total}</span>
                )}
            </div>

            {!address && (
                <div className="documents-state">
                    <i className="bx bx-wallet" />
                    <span>Connect your wallet to view documents.</span>
                </div>
            )}

            {loading && (
                <div className="documents-state">
                    <i className="bx bx-loader-alt documents-spin" />
                    <span>Loading documents...</span>
                </div>
            )}

            {error && (
                <div className="documents-state documents-state--error">
                    <i className="bx bx-error-circle" />
                    <span>Failed to load documents.</span>
                </div>
            )}

            {docs && docs.length === 0 && (
                <div className="documents-state">
                    <i className="bx bx-file" />
                    <span>No documents issued yet.</span>
                    <Link to="/upload" className="documents-state-cta">
                        <i className="bx bx-plus" />
                        Issue your first document
                    </Link>
                </div>
            )}

            {docs && docs.length > 0 && (
                <>
                    <div className="documents-list">
                        <div className="documents-list-header">
                            <span>Title</span>
                            <span>Recipient</span>
                            <span>Email</span>
                            <span>Hash</span>
                            <span>Issued</span>
                            <span>On-chain</span>
                        </div>
                        {docs.map(doc => (
                            <div
                                key={doc.id}
                                className="documents-row documents-row--clickable"
                                onClick={() => setSelected(doc)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(doc) } }}
                            >
                                <span className="documents-cell documents-cell--title">
                                    <i className="bx bxs-file-pdf" />
                                    {doc.title}
                                </span>
                                <span className="documents-cell">{doc.recipient}</span>
                                <span className="documents-cell documents-cell--muted">{doc.email}</span>
                                <span className="documents-cell documents-cell--hash" title={doc.blake3_hash}>
                                    {truncHash(doc.blake3_hash)}
                                </span>
                                <span className="documents-cell documents-cell--muted">{fmtDate(doc.created_at)}</span>
                                <span className="documents-cell" onClick={e => e.stopPropagation()}>
                                    {doc.stellar_hash ? (
                                        <a
                                            className="documents-badge documents-badge--on"
                                            href={EXPLORER_TX(doc.stellar_hash)}
                                            target="_blank"
                                            rel="noreferrer"
                                            title={doc.stellar_hash}
                                        >
                                            <i className="bx bx-check" />
                                            On-chain
                                        </a>
                                    ) : (
                                        <span className="documents-badge documents-badge--off">
                                            Pending
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="documents-pagination">
                            <button
                                className="documents-page-btn"
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                            >
                                <i className="bx bx-chevron-left" />
                            </button>
                            {pageList(page, totalPages).map((p, i) =>
                                p === '…' ? (
                                    <span key={`e${i}`} className="documents-page-ellipsis">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        className={`documents-page-btn${p === page ? ' active' : ''}`}
                                        onClick={() => setPage(p)}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button
                                className="documents-page-btn"
                                disabled={page === totalPages}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            >
                                <i className="bx bx-chevron-right" />
                            </button>
                        </div>
                    )}
                </>
            )}

            <Modal
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected?.title ?? ''}
                subtitle="Document details"
            >
                {selected && (
                    <div className="modal-fields">
                        <div className="modal-field">
                            <span className="modal-field-label">Recipient</span>
                            <span className="modal-field-value">{selected.recipient}</span>
                        </div>
                        <div className="modal-field">
                            <span className="modal-field-label">Email</span>
                            <span className="modal-field-value">{selected.email}</span>
                        </div>
                        <div className="modal-field">
                            <span className="modal-field-label">Issued</span>
                            <span className="modal-field-value">
                                {new Date(selected.created_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                            </span>
                        </div>
                        <div className="modal-field">
                            <span className="modal-field-label">Stellar anchor</span>
                            {selected.stellar_hash ? (
                                <a
                                    className="modal-field-link"
                                    href={EXPLORER_TX(selected.stellar_hash)}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <i className="bx bx-link-external" />
                                    View on Stellar Explorer
                                </a>
                            ) : (
                                <span className="modal-tag modal-tag--neutral">
                                    <i className="bx bx-time" />
                                    Pending
                                </span>
                            )}
                        </div>

                        <details className="modal-disclosure">
                            <summary>
                                <i className="bx bx-chevron-right" />
                                Technical details
                            </summary>
                            <div className="modal-disclosure-body">
                                <div className="modal-field">
                                    <span className="modal-field-label">BLAKE3 hash</span>
                                    <span className="modal-field-value modal-field-value--mono">{selected.blake3_hash}</span>
                                </div>
                                {selected.stellar_hash && (
                                    <div className="modal-field">
                                        <span className="modal-field-label">Stellar tx hash</span>
                                        <span className="modal-field-value modal-field-value--mono">{selected.stellar_hash}</span>
                                    </div>
                                )}
                                <div className="modal-field">
                                    <span className="modal-field-label">Document ID</span>
                                    <span className="modal-field-value modal-field-value--mono">{selected.id}</span>
                                </div>
                            </div>
                        </details>
                    </div>
                )}
            </Modal>

        </div>
    )
}

export default Documents
