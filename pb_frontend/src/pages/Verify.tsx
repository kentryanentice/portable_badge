import { useState, useRef } from 'react'
import { EXPLORER_TX } from '../lib/contract'

type VerifyResult = {
    id:           string
    title:        string
    recipient:    string
    email:        string
    blake3_hash:  string
    stellar_hash: string | null
    created_at:   string
}

type State =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'found'; data: VerifyResult; hash: string }
    | { status: 'tampered' }
    | { status: 'not_found' }

const ENGINE = import.meta.env.VITE_API_URL

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function Verify() {
    const [state, setState] = useState<State>({ status: 'idle' })
    const [drag, setDrag]   = useState(false)
    const inputRef          = useRef<HTMLInputElement>(null)

    const check = async (file: File) => {
        if (file.type !== 'application/pdf') return
        setState({ status: 'loading' })
        const fd = new FormData()
        fd.append('file', file)
        try {
            const res = await fetch(`${ENGINE}/document/verify`, { method: 'POST', body: fd })
            if (res.ok) {
                const data = await res.json()
                setState({ status: 'found', data, hash: data.blake3_hash })
            } else if (res.status === 409) {
                setState({ status: 'tampered' })
            } else {
                setState({ status: 'not_found' })
            }
        } catch {
            setState({ status: 'not_found' })
        }
    }

    const onFiles = (files: FileList | null) => {
        if (!files?.length) return
        check(files[0])
    }

    const reset = () => setState({ status: 'idle' })

    return (
        <div className="verify">

            <div className="verify-header">
                <h1 className="verify-title">Verify Document</h1>
                <p className="verify-subtitle">Drop a PDF to check if it matches an issued badge. No Credits required.</p>
            </div>

            {state.status === 'idle' && (
                <div
                    className={`verify-zone${drag ? ' drag' : ''}`}
                    onClick={() => inputRef.current?.click()}
                    onDrop={e => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files) }}
                    onDragOver={e => { e.preventDefault(); setDrag(true) }}
                    onDragLeave={() => setDrag(false)}
                >
                    <input ref={inputRef} type="file" accept=".pdf" hidden onChange={e => onFiles(e.target.files)} />
                    <i className="bx bx-shield-quarter" />
                    <p>Drop a PDF here or <span>browse files</span></p>
                    <small>PDF only · We'll verify the document hash</small>
                </div>
            )}

            {state.status === 'loading' && (
                <div className="verify-zone verify-loading">
                    <i className="bx bx-loader-alt verify-spin" />
                    <p>Verifying document...</p>
                </div>
            )}

            {state.status === 'found' && (
                <div className="verify-result">
                    <div className="verify-badge verified">
                        <i className="bx bx-check-circle" />
                        <span>Verified</span>
                    </div>
                    <div className="verify-card">
                        <div className="verify-field">
                            <span className="verify-field-label">Title</span>
                            <span className="verify-field-value">{state.data.title}</span>
                        </div>
                        <div className="verify-field">
                            <span className="verify-field-label">Recipient</span>
                            <span className="verify-field-value">{state.data.recipient}</span>
                        </div>
                        <div className="verify-field">
                            <span className="verify-field-label">Email</span>
                            <span className="verify-field-value">{state.data.email}</span>
                        </div>
                        <div className="verify-field">
                            <span className="verify-field-label">Issued</span>
                            <span className="verify-field-value">{fmtDate(state.data.created_at)}</span>
                        </div>
                        <div className="verify-field">
                            <span className="verify-field-label">Document hash</span>
                            <span className="verify-field-value verify-hash">{state.data.blake3_hash}</span>
                        </div>
                        {state.data.stellar_hash && (
                            <div className="verify-field">
                                <span className="verify-field-label">On-chain</span>
                                <a
                                    className="verify-field-value verify-hash"
                                    href={EXPLORER_TX(state.data.stellar_hash)}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {state.data.stellar_hash}
                                </a>
                            </div>
                        )}
                    </div>
                    <button className="verify-reset" onClick={reset}>
                        <i className="bx bx-refresh" />
                        <span>Verify another</span>
                    </button>
                </div>
            )}

            {state.status === 'tampered' && (
                <div className="verify-result">
                    <div className="verify-badge unverified">
                        <i className="bx bx-shield-x" />
                        <span>Tampered</span>
                    </div>
                    <div className="verify-tamper-info">
                        <div className="verify-tamper-row">
                            <i className="bx bx-error" />
                            <span>This PDF contains a Portable Badge certificate, but its hash does not match any issued document. The file was modified after the badge was issued.</span>
                        </div>
                        <div className="verify-tamper-row verify-tamper-row--tip">
                            <i className="bx bx-info-circle" />
                            <span>Even a single byte change produces a completely different hash — making tampering detectable.</span>
                        </div>
                    </div>
                    <button className="verify-reset" onClick={reset}>
                        <i className="bx bx-refresh" />
                        <span>Try another</span>
                    </button>
                </div>
            )}

            {state.status === 'not_found' && (
                <div className="verify-result">
                    <div className="verify-badge warning">
                        <i className="bx bx-question-mark" />
                        <span>Not Found</span>
                    </div>
                    <div className="verify-notfound-info">
                        <div className="verify-tamper-row">
                            <i className="bx bx-info-circle" />
                            <span>No badge record matches this document. It has not been registered with Portable Badge.</span>
                        </div>
                    </div>
                    <button className="verify-reset" onClick={reset}>
                        <i className="bx bx-refresh" />
                        <span>Try another</span>
                    </button>
                </div>
            )}

        </div>
    )
}

export default Verify
