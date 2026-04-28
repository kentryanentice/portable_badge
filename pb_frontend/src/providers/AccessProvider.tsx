import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Session } from './SessionProvider'

interface Props {
    children: ReactNode
}

function AccessProvider({ children }: Props) {
    const {
        loading,
        user,
    } = Session()

    const location = useLocation()

    const publicRoutes = ['/auth']
    const adminRoutes = ['/admin']
    const userRoutes = ['/dashboard', '/upload', '/verify', '/documents', '/settings']
    const privateRoutes = [...adminRoutes, ...userRoutes]
    const isPrivateRoute = privateRoutes.some(r => location.pathname.startsWith(r))

    if (!isPrivateRoute || publicRoutes.includes(location.pathname)) return <>{children}</>

    if (loading && !user) return <div className='loader' />

    if (!user) return <Navigate to='/auth' replace state={{ from: location }} />

    if (user.role === 'Admin') {
        return adminRoutes.some(r => location.pathname.startsWith(r))
            ? <>{children}</>
            : <Navigate to='/' replace />
    }

    if (user.role === 'User') {
        return userRoutes.some(r => location.pathname.startsWith(r))
            ? <>{children}</>
            : <Navigate to='/' replace />
    }

    return <Navigate to='/' replace />
}

export default AccessProvider
