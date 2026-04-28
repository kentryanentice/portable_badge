import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../providers/ThemeProvider'
import { useFreighter } from '../providers/FreighterProvider'

function Settings() {
    const { address, network, disconnect } = useFreighter()
    const { theme, setTheme }              = useTheme()
    const navigate                         = useNavigate()
    const [copied, setCopied]              = useState(false)

    const short    = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '—'
    const initials = address ? address.slice(0, 2).toUpperCase() : '??'
    const hue      = address
        ? parseInt(address.slice(0, 6).replace(/[^0-9a-fA-F]/g, '0').slice(0, 4) || '0', 16) % 360
        : 200

    const handleCopy = () => {
        if (!address) return
        navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleDisconnect = () => {
        disconnect()
        navigate('/auth', { replace: true })
    }

    return (
        <div className="settings">

            <div className="settings-header">
                <h1 className="settings-title">Settings</h1>
                <p className="settings-subtitle">Manage your account preferences and connected wallet.</p>
            </div>

            <section className="settings-section">
                <p className="settings-label">Profile & Wallet</p>
                <div className="settings-card">
                    <div
                        className="settings-avatar"
                        style={{ '--avatar-hue': hue } as React.CSSProperties}
                    >
                        {initials}
                    </div>
                    <div className="settings-info">
                        <div className="settings-info-row">
                            <span className="settings-info-value">{short}</span>
                            <button
                                className="settings-copy"
                                onClick={handleCopy}
                                title={copied ? 'Copied!' : 'Copy full address'}
                            >
                                <i className={`bx ${copied ? 'bx-check' : 'bx-copy'}`} />
                            </button>
                        </div>
                        <span className="settings-network">{network.toLowerCase()}</span>
                    </div>
                </div>
            </section>

            <section className="settings-section">
                <p className="settings-label">Appearance</p>
                <div className="settings-segment">
                    <button
                        className={`settings-segment-btn${theme === 'light' ? ' active' : ''}`}
                        onClick={() => setTheme('light')}
                    >
                        <i className="bx bx-sun" />
                        <span>Light</span>
                    </button>
                    <button
                        className={`settings-segment-btn${theme === 'dark' ? ' active' : ''}`}
                        onClick={() => setTheme('dark')}
                    >
                        <i className="bx bx-moon" />
                        <span>Dark</span>
                    </button>
                </div>
            </section>

            <section className="settings-section">
                <p className="settings-label">Danger Zone</p>
                <div className="settings-card settings-card--danger">
                    <div className="settings-danger-info">
                        <span className="settings-danger-title">Disconnect Wallet</span>
                        <span className="settings-danger-desc">You will need to reconnect to access the dashboard.</span>
                    </div>
                    <button className="settings-disconnect" onClick={handleDisconnect}>
                        <i className="bx bx-log-out" />
                        <span>Disconnect</span>
                    </button>
                </div>
            </section>

        </div>
    )
}

export default Settings
