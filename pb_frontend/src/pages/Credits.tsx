import { useEffect, useState } from 'react'
import { useFreighter } from '../providers/FreighterProvider'
import { EXPLORER_TX } from '../lib/contract'
import { PurchaseError, payTreasury, stroopsToXlm } from '../lib/stellar'

type Plan = {
    id:            string
    label:         string
    credits:       number
    price_stroops: number
}

type PlansResponse = {
    items:    Plan[]
    treasury: string | null
}

type PurchaseResponse = {
    credits_added:   number
    new_balance:     number
    stellar_tx_hash: string
    transaction_id:  string
}

type Status =
    | { phase: 'idle' }
    | { phase: 'signing',  plan: Plan }
    | { phase: 'verifying', plan: Plan, tx: string }
    | { phase: 'success',  plan: Plan, tx: string, balance: number }
    | { phase: 'error',    plan: Plan, message: string }

const ENGINE = import.meta.env.VITE_API_URL

function Credits() {
    const { address }           = useFreighter()
    const [plans, setPlans]     = useState<Plan[] | null>(null)
    const [treasury, setTreasury] = useState<string | null>(null)
    const [balance, setBalance] = useState<number | null>(null)
    const [status, setStatus]   = useState<Status>({ phase: 'idle' })
    const [loadError, setLoadError] = useState(false)

    useEffect(() => {
        const ctrl = new AbortController()
        fetch(`${ENGINE}/credits/plans`, { signal: ctrl.signal })
            .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<PlansResponse> })
            .then(data => { setPlans(data.items); setTreasury(data.treasury) })
            .catch(e => { if (e.name !== 'AbortError') setLoadError(true) })
        return () => ctrl.abort()
    }, [])

    useEffect(() => {
        if (!address) { setBalance(null); return }
        const ctrl = new AbortController()
        fetch(`${ENGINE}/credits/balance`, {
            headers: { 'x-wallet': address },
            signal:  ctrl.signal,
        })
            .then(r => r.ok ? r.json() : null)
            .then((data: { balance: number } | null) => { if (data) setBalance(data.balance) })
            .catch(() => {})
        return () => ctrl.abort()
    }, [address, status.phase])

    const handlePurchase = async (plan: Plan) => {
        if (!address || !treasury) return
        setStatus({ phase: 'signing', plan })

        const receiptId = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
        const memo = `${plan.id}|${receiptId}`

        let txHash: string
        try {
            txHash = await payTreasury({
                fromAddress: address,
                treasury,
                stroops:     plan.price_stroops,
                memo,
            })
        } catch (e) {
            const err = e as PurchaseError
            const message =
                err.code === 'freighter' ? 'Wallet declined or unavailable' :
                err.code === 'horizon'   ? 'Could not load account — is it funded?' :
                err.code === 'submit'    ? `Stellar rejected the payment: ${err.message}` :
                'Network error during payment'
            setStatus({ phase: 'error', plan, message })
            return
        }

        setStatus({ phase: 'verifying', plan, tx: txHash })

        try {
            const res = await fetch(`${ENGINE}/credits/purchase`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'x-wallet': address },
                body:    JSON.stringify({ plan_id: plan.id, stellar_tx_hash: txHash }),
            })
            if (!res.ok) {
                const text = await res.text().catch(() => '')
                setStatus({
                    phase: 'error',
                    plan,
                    message: `Verification failed (${res.status}): ${text || 'unknown'}`,
                })
                return
            }
            const data = await res.json() as PurchaseResponse
            setStatus({ phase: 'success', plan, tx: txHash, balance: data.new_balance })
        } catch {
            setStatus({
                phase: 'error',
                plan,
                message: 'Payment landed on chain but server verification failed. Refresh — it may still post.',
            })
        }
    }

    const busy = status.phase === 'signing' || status.phase === 'verifying'

    return (
        <div className="credits">

            <div className="credits-header">
                <div>
                    <h1 className="credits-title">Buy Credits</h1>
                    <p className="credits-subtitle">Credit lets you upload and anchor one document. Pay in XLM via your wallet.</p>
                </div>
                {balance !== null && (
                    <span className="credits-balance">
                        <i className="bx bx-wallet" />
                        {balance} credits
                    </span>
                )}
            </div>

            {!address && (
                <div className="credits-state">
                    <i className="bx bx-wallet" />
                    <span>Connect your wallet to purchase credits.</span>
                </div>
            )}

            {address && loadError && (
                <div className="credits-state credits-state--error">
                    <i className="bx bx-error-circle" />
                    <span>Failed to load plans.</span>
                </div>
            )}

            {address && !plans && !loadError && (
                <div className="credits-state">
                    <i className="bx bx-loader-alt credits-spin" />
                    <span>Loading plans...</span>
                </div>
            )}

            {address && plans && treasury && (
                <div className="credits-grid">
                    {plans.map((plan, i) => {
                        const featured = i === 1
                        const xlm = stroopsToXlm(plan.price_stroops)
                        const perCredit = (Number(xlm) / plan.credits).toFixed(2)

                        return (
                            <div key={plan.id} className={`credits-card${featured ? ' credits-card--featured' : ''}`}>
                                {featured && <span className="credits-card-badge">Most popular</span>}
                                <span className="credits-card-label">{plan.label}</span>
                                <div className="credits-card-price">
                                    <span className="credits-card-price-amount">{xlm}</span>
                                    <span className="credits-card-price-asset">XLM</span>
                                </div>
                                <span className="credits-card-rate">{perCredit} XLM per credit</span>
                                <ul className="credits-card-features">
                                    <li><i className="bx bx-check" /> {plan.credits} document credits</li>
                                    <li><i className="bx bx-check" /> On-chain Stellar audit trail</li>
                                    <li><i className="bx bx-check" /> Recipient email delivery</li>
                                    <li><i className="bx bx-check" /> Unlimited verification</li>
                                </ul>
                                <button
                                    className="credits-card-btn"
                                    disabled={busy}
                                    onClick={() => handlePurchase(plan)}
                                >
                                    {busy && status.plan.id === plan.id ? (
                                        <>
                                            <i className="bx bx-loader-alt credits-spin" />
                                            <span>{status.phase === 'signing' ? 'Awaiting wallet...' : 'Verifying...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="bx bx-cart-add" />
                                            <span>Buy {plan.credits} credits</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {status.phase === 'success' && (
                <div className="credits-toast credits-toast--success">
                    <i className="bx bx-check-circle" />
                    <div className="credits-toast-body">
                        <strong>{status.plan.credits} credits added.</strong> New balance: {status.balance}.
                        <a href={EXPLORER_TX(status.tx)} target="_blank" rel="noreferrer">View on Stellar</a>
                    </div>
                    <button className="credits-toast-close" onClick={() => setStatus({ phase: 'idle' })}>
                        <i className="bx bx-x" />
                    </button>
                </div>
            )}

            {status.phase === 'error' && (
                <div className="credits-toast credits-toast--error">
                    <i className="bx bx-x-circle" />
                    <div className="credits-toast-body">
                        <strong>Purchase failed.</strong> {status.message}
                    </div>
                    <button className="credits-toast-close" onClick={() => setStatus({ phase: 'idle' })}>
                        <i className="bx bx-x" />
                    </button>
                </div>
            )}

        </div>
    )
}

export default Credits
