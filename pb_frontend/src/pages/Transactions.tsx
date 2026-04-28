import { useEffect, useState } from 'react'
import { useFreighter } from '../providers/FreighterProvider'
import { EXPLORER_TX } from '../lib/contract'
import Modal from '../elements/Modal'

type Tx = {
    id:                    string
    delta:                 number
    reason:                'purchase' | 'consume' | 'refund'
    plan_id:               string | null
    stellar_tx_hash:       string | null
    document_id:           string | null
    document_title:        string | null
    document_stellar_hash: string | null
    memo:                  string | null
    created_at:            string
}

type ListResponse = {
    items:    Tx[]
    total:    number
    balance:  number
    page:     number
    per_page: number
}

const ENGINE   = import.meta.env.VITE_API_URL
const PER_PAGE = 20

function truncHash(h: string) {
    return `${h.slice(0, 10)}…${h.slice(-8)}`
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-US',
        { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateLong(iso: string) {
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
}

function reasonParts(t: Tx): { primary: string; secondary: string | null } {
    const title = t.document_title ?? null
    if (t.reason === 'purchase') {
        return { primary: 'Purchased credits', secondary: t.plan_id ?? null }
    }
    if (t.reason === 'consume') {
        if (t.memo === 'upload+email') return { primary: 'Badge issued + emailed', secondary: title }
        if (t.memo === 'upload')       return { primary: 'Badge issued',           secondary: title }
        if (t.memo === 'email')        return { primary: 'Email sent',             secondary: title } // legacy
        return { primary: 'Badge issued', secondary: title }
    }
    if (t.reason === 'refund') {
        if (t.memo === 'email_failed') return { primary: 'Email refund', secondary: title }
        return { primary: 'Refund', secondary: null }
    }
    return { primary: t.reason, secondary: null }
}

function onChainHash(t: Tx): string | null {
    return t.stellar_tx_hash ?? t.document_stellar_hash ?? null
}

function onChainLabel(t: Tx) {
    if (t.reason === 'purchase') return 'Payment transaction'
    return 'Badge anchor transaction'
}

function CopyableMono({ value }: { value: string }) {
    const [copied, setCopied] = useState(false)
    const onCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        }).catch(() => {})
    }
    return (
        <button type="button" className="modal-copyable" onClick={onCopy} title={copied ? 'Copied' : 'Click to copy'}>
            <span className="modal-copyable-text">{value}</span>
            <i className={`bx ${copied ? 'bx-check' : 'bx-copy'}`} />
        </button>
    )
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

function Transactions() {
    const { address }             = useFreighter()
    const [items, setItems]       = useState<Tx[] | null>(null)
    const [total, setTotal]       = useState(0)
    const [balance, setBalance]   = useState(0)
    const [page, setPage]         = useState(1)
    const [error, setError]       = useState(false)
    const [selected, setSelected] = useState<Tx | null>(null)
    const [lastAddr, setLastAddr] = useState<string | null | undefined>(address)

    if (lastAddr !== address) {
        setLastAddr(address)
        setItems(null)
        setTotal(0)
        setBalance(0)
        setPage(1)
        setError(false)
    }

    useEffect(() => {
        if (!address) return
        const ctrl = new AbortController()
        fetch(`${ENGINE}/credits/transactions?page=${page}&per_page=${PER_PAGE}`, {
            headers: { 'x-wallet': address },
            signal: ctrl.signal,
        })
            .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<ListResponse> })
            .then(data => { setItems(data.items); setTotal(data.total); setBalance(data.balance) })
            .catch(e => { if (e.name !== 'AbortError') setError(true) })
        return () => ctrl.abort()
    }, [address, page])

    const loading    = items === null && !error && !!address
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

    return (
        <div className="documents">
            <div className="documents-header">
                <div>
                    <h1 className="documents-title">Transactions</h1>
                    <p className="documents-subtitle">Credit purchases and uploads. On-chain payments link to the Stellar explorer.</p>
                </div>
                <span className="documents-count">{balance} credits</span>
            </div>

            {!address && (
                <div className="documents-state">
                    <i className="bx bx-wallet" />
                    <span>Connect your wallet to view transactions.</span>
                </div>
            )}

            {loading && (
                <div className="documents-state">
                    <i className="bx bx-loader-alt documents-spin" />
                    <span>Loading transactions...</span>
                </div>
            )}

            {error && (
                <div className="documents-state documents-state--error">
                    <i className="bx bx-error-circle" />
                    <span>Failed to load transactions.</span>
                </div>
            )}

            {items && items.length === 0 && (
                <div className="documents-state">
                    <i className="bx bx-receipt" />
                    <span>No transactions yet.</span>
                </div>
            )}

            {items && items.length > 0 && (
                <>
                    <div className="documents-list">
                        <div className="documents-list-header">
                            <span>Type</span>
                            <span>Change</span>
                            <span>Stellar Tx</span>
                            <span>Date</span>
                        </div>
                        {items.map(t => {
                            const hash = onChainHash(t)
                            const parts = reasonParts(t)
                            return (
                                <div
                                    key={t.id}
                                    className="documents-row documents-row--clickable"
                                    onClick={() => setSelected(t)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(t) } }}
                                >
                                    <span className="documents-cell documents-cell--title">
                                        <i
                                            className={`bx ${t.delta > 0 ? 'bx-plus-circle' : 'bx-minus-circle'}`}
                                            style={{ color: t.delta > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                                        />
                                        <span className="documents-cell-stack">
                                            <span className="documents-cell-stack-primary">{parts.primary}</span>
                                            {parts.secondary && (
                                                <span className="documents-cell-stack-secondary">{parts.secondary}</span>
                                            )}
                                        </span>
                                    </span>
                                    <span
                                        className="documents-cell"
                                        style={{ color: t.delta > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 500 }}
                                    >
                                        {t.delta > 0 ? `+${t.delta}` : `${t.delta}`}
                                    </span>
                                    <span className="documents-cell" onClick={e => e.stopPropagation()}>
                                        {hash ? (
                                            <a
                                                className="documents-badge documents-badge--on"
                                                href={EXPLORER_TX(hash)}
                                                target="_blank"
                                                rel="noreferrer"
                                                title={hash}
                                            >
                                                <i className="bx bx-link-external" />
                                                {truncHash(hash)}
                                            </a>
                                        ) : (
                                            <span className="documents-cell--muted">—</span>
                                        )}
                                    </span>
                                    <span className="documents-cell documents-cell--muted">{fmtDate(t.created_at)}</span>
                                </div>
                            )
                        })}
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
                title={selected ? reasonParts(selected).primary : ''}
                subtitle="Transaction details"
            >
                {selected && (() => {
                    const hash      = onChainHash(selected)
                    const positive  = selected.delta > 0
                    return (
                        <div className="modal-fields">
                            <div className="modal-hero">
                                <div className={`modal-hero-amount modal-hero-amount--${positive ? 'positive' : 'negative'}`}>
                                    {positive ? `+${selected.delta}` : `${selected.delta}`}
                                </div>
                                <div className="modal-hero-label">credits</div>
                            </div>

                            <div className="modal-field">
                                <span className="modal-field-label">When</span>
                                <span className="modal-field-value">{fmtDateLong(selected.created_at)}</span>
                            </div>

                            {selected.plan_id && (
                                <div className="modal-field">
                                    <span className="modal-field-label">Plan</span>
                                    <span className="modal-field-value">{selected.plan_id}</span>
                                </div>
                            )}

                            {selected.document_title && (
                                <div className="modal-field">
                                    <span className="modal-field-label">Document</span>
                                    <span className="modal-field-value">{selected.document_title}</span>
                                </div>
                            )}

                            {hash && (
                                <div className="modal-field">
                                    <span className="modal-field-label">{onChainLabel(selected)}</span>
                                    <a
                                        className="modal-field-link"
                                        href={EXPLORER_TX(hash)}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <i className="bx bx-link-external" />
                                        View on Stellar Explorer
                                    </a>
                                </div>
                            )}

                            <details className="modal-disclosure">
                                <summary>
                                    <i className="bx bx-chevron-right" />
                                    Technical details
                                </summary>
                                <div className="modal-disclosure-body">
                                    {hash && (
                                        <div className="modal-field">
                                            <span className="modal-field-label">{onChainLabel(selected)} hash</span>
                                            <CopyableMono value={hash} />
                                        </div>
                                    )}
                                    {selected.document_id && (
                                        <div className="modal-field">
                                            <span className="modal-field-label">Document ID</span>
                                            <CopyableMono value={selected.document_id} />
                                        </div>
                                    )}
                                    <div className="modal-field">
                                        <span className="modal-field-label">Transaction ID</span>
                                        <CopyableMono value={selected.id} />
                                    </div>
                                </div>
                            </details>
                        </div>
                    )
                })()}
            </Modal>
        </div>
    )
}

export default Transactions
