import { useLocation, useNavigate } from 'react-router-dom'

const navItems = [
    { label: 'Dashboard', icon: 'bx bxs-dashboard',     path: '/dashboard' },
    { label: 'Upload',    icon: 'bx bxs-cloud-upload',  path: '/upload' },
    { label: 'Verify',    icon: 'bx bxs-check-shield',  path: '/verify' },
    { label: 'Documents',    icon: 'bx bxs-file',     path: '/documents' },
    { label: 'Credits',      icon: 'bx bxs-wallet',   path: '/credits' },
    { label: 'Transactions', icon: 'bx bxs-receipt',  path: '/transactions' },
    { label: 'Settings',     icon: 'bx bxs-cog',      path: '/settings' },
]

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean, onToggle: () => void }) {
    const location = useLocation()
    const navigate = useNavigate()

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <button className="sidebar-toggle" onClick={onToggle}>
                    <i className={`bx ${collapsed ? 'bxs-chevrons-right' : 'bxs-chevrons-left'}`} />
                </button>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <button
                        key={item.path}
                        className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
                        onClick={() => navigate(item.path)}
                        title={collapsed ? item.label : undefined}
                    >
                        <i className={item.icon} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    )
}
