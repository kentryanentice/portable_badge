import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode, Dispatch, SetStateAction } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Location, NavigateFunction } from 'react-router-dom'

export interface SessionPayload {
    id: string
    email: string
    username: string
    role: 'Admin' | 'User' | string
    expires_at: number
}

interface SessionContextValue {
    loading: boolean
    user: SessionPayload | null
    userDetails: unknown
    setUser: Dispatch<SetStateAction<SessionPayload | null>>
    setUserDetails: Dispatch<SetStateAction<unknown>>
    navigate: NavigateFunction
    location: Location
}

interface SessionProviderProps {
    children: ReactNode
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined)

export const SessionProvider = ({ children }: SessionProviderProps) => {
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<SessionPayload | null>(null)
    const [userDetails, setUserDetails] = useState<unknown>(null)

    const navigate = useNavigate()
    const location = useLocation()

    const nullRoutes = ['/auth']
    const adminRoutes = ['/admin']
    const userRoutes = ['/dashboard', '/upload', '/verify', '/documents', '/settings']
    const privateRoutes = [...adminRoutes, ...userRoutes]

    useEffect(() => {
        let aborted = false

        const ENGINE = import.meta.env.VITE_API_URL

        const navigateIfNeeded = (to: string) => {
            if (location.pathname !== to) navigate(to, { replace: true })
        }

        const run = async () => {
            const isPrivate = privateRoutes.some(r => location.pathname.startsWith(r))

            setLoading(true)
            try {
                const res = await fetch(`${ENGINE}/session`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                })

                if (res.status === 401) {
                    if (!aborted) setUser(null)
                    if (isPrivate) navigateIfNeeded('/')
                    return
                }

                if (!res.ok) {
                    if (isPrivate) navigateIfNeeded('/')
                    return
                }

                const nextUser = await res.json() as SessionPayload

                if (!nextUser?.username || !nextUser?.email || !nextUser?.role) {
                    if (!aborted) setUser(null)
                    if (isPrivate) navigateIfNeeded('/')
                    return
                }

                if (!aborted) setUser(nextUser)

                if (nextUser.role === 'Admin') {
                    if (nullRoutes.includes(location.pathname)) navigateIfNeeded('/admin')
                    return
                }

                if (nextUser.role === 'User') {
                    if (nullRoutes.includes(location.pathname)) navigateIfNeeded('/dashboard')
                    return
                }

                if (isPrivate) navigateIfNeeded('/')
            } catch {
                const isPrivate = privateRoutes.some(r => location.pathname.startsWith(r))
                if (isPrivate) navigateIfNeeded('/')
            } finally {
                if (!aborted) setLoading(false)
            }
        }

        run()

        const onRefresh = () => { if (!aborted) run() }
        window.addEventListener('session:refresh', onRefresh)

        return () => {
            aborted = true
            window.removeEventListener('session:refresh', onRefresh)
        }
    }, [location.pathname, navigate])

    return (
        <SessionContext.Provider value={{ loading, user, userDetails, setUser, setUserDetails, navigate, location }}>
            {children}
        </SessionContext.Provider>
    )
}

export const Session = (): SessionContextValue => {
    const ctx = useContext(SessionContext)
    if (!ctx) throw new Error('Session must be used within SessionProvider')
    return ctx
}
