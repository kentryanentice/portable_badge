import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import Sidebar from '../elements/Sidebar'
import { useFreighter } from '../providers/FreighterProvider'

function Dashboard() {
    const [collapsed, setCollapsed] = useState(false)
    const { address, ready } = useFreighter()

    if (!ready) return <div className='loader' />
    if (!address) return <Navigate to='/auth' replace />

    return (
        <div className={`dashboard${collapsed ? ' sidebar-collapsed' : ''}`}>
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
            <main className="dashboard-content">
                <Outlet />
            </main>
        </div>
    )
}

export default Dashboard
