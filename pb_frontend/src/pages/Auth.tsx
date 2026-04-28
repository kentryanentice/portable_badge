import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useFreighter } from '../providers/FreighterProvider'

function Auth() {
    const { address, connect, ready } = useFreighter()
    const nav = useNavigate()
    const [tos, setTos] = useState(false)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    useEffect(() => { if (address) nav('/dashboard') }, [address, nav])

    const handleConnect = async () => {
        setError('')
        setBusy(true)
        try {
            await connect()
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to connect'
            setError(msg.includes('not installed') || msg.includes('Freighter')
                ? 'Freighter is not installed. Install the extension and reload.'
                : msg)
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="auth">
            <div className="auth-body">
                <div className="auth-left">
                    <img src="/pictures/stellar.webp" alt="Stellar" className="auth-wallet-ico" />
                    <h2>Need a wallet?</h2>
                    <p>Get the Freighter browser extension to verify documents on-chain in seconds.</p>
                    <a href="https://www.freighter.app" target="_blank" rel="noreferrer" className="auth-create">
                        Get Freighter
                    </a>
                    <small>Powered by Stellar</small>
                </div>

                <div className="auth-sep"><span>or</span></div>

                <div className="auth-right">
                    <button className="auth-wallet-btn" onClick={handleConnect} disabled={!ready || busy}>
                        <img src="/pictures/stellar.webp" alt="" />
                        {busy ? 'Connecting...' : 'Connect Freighter'}
                    </button>
                    {error && <p className="auth-no-wallet">{error}</p>}
                    <Link to="/public/verify" className="auth-verify-link">
                        Just want to verify a document?
                    </Link>
                </div>
            </div>

            <footer className="auth-footer">
                By connecting your wallet and using Portable Badge, you agree to our{' '}
                <a href="#" onClick={e => { e.preventDefault(); setTos(true) }}>Terms of Service</a>.
            </footer>

            {tos && (
                <div className="tos-overlay" onClick={() => setTos(false)}>
                    <div className="tos-modal" onClick={e => e.stopPropagation()}>
                        <div className="tos-header">
                            <h2>Terms of Service</h2>
                            <button onClick={() => setTos(false)}><X size={20} /></button>
                        </div>
                        <div className="tos-body">
                            <p><strong>Portable Badge</strong> is an on-chain document verification system built on the Stellar blockchain. By connecting your wallet, you agree to the following terms.</p>

                            <h3>1. Acceptance</h3>
                            <p>By connecting a wallet and using Portable Badge, you accept these terms in full. If you disagree, do not use this service.</p>

                            <h3>2. On-Chain Data</h3>
                            <p>Document hashes issued through Portable Badge are anchored on the Stellar blockchain via Soroban and are permanently public and immutable. You are solely responsible for the accuracy of data you submit.</p>

                            <h3>3. Wallet Responsibility</h3>
                            <p>You are responsible for securing your wallet and private keys. Portable Badge has no ability to recover lost wallets or reverse on-chain transactions.</p>

                            <h3>4. No Warranty</h3>
                            <p>This service is provided "as is" without warranty of any kind. Portable Badge does not guarantee uptime, accuracy of third-party data, or fitness for any particular purpose.</p>

                            <h3>5. Prohibited Use</h3>
                            <p>You may not use Portable Badge to issue fraudulent credentials, impersonate individuals or organizations, or violate any applicable laws.</p>

                            <h3>6. Changes</h3>
                            <p>These terms may be updated at any time. Continued use of the service constitutes acceptance of the revised terms.</p>
                        </div>
                        <div className="tos-footer">
                            <button className="tos-accept" onClick={() => setTos(false)}>I Understand</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}

export default Auth
