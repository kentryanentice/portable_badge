import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
    isConnected,
    requestAccess,
    getAddress,
    getNetwork,
    setAllowed,
} from '@stellar/freighter-api'

type Ctx = {
    address: string | null
    network: string
    ready: boolean
    connect: () => Promise<void>
    disconnect: () => void
}

const FreighterCtx = createContext<Ctx | null>(null)

const STORAGE_KEY = 'pb_freighter_connected'
const DEFAULT_NETWORK = 'TESTNET'

function unwrap<T extends { error?: unknown }>(res: T): T {
    if (res && 'error' in res && res.error) {
        throw new Error(typeof res.error === 'string' ? res.error : 'Freighter error')
    }
    return res
}

function FreighterProvider({ children }: { children: React.ReactNode }) {
    const [address, setAddress] = useState<string | null>(null)
    const [network, setNetwork] = useState<string>(DEFAULT_NETWORK)
    const [ready, setReady] = useState(false)

    const refresh = useCallback(async () => {
        try {
            const conn = unwrap(await isConnected())
            if (!conn?.isConnected) { setAddress(null); return }
            const addr = unwrap(await getAddress())
            if (addr?.address) {
                setAddress(addr.address)
                const net = unwrap(await getNetwork())
                if (net?.network) setNetwork(net.network)
            } else {
                setAddress(null)
            }
        } catch {
            setAddress(null)
        }
    }, [])

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === '1') {
            refresh().finally(() => setReady(true))
        } else {
            setReady(true)
        }
    }, [refresh])

    const connect = useCallback(async () => {
        try { unwrap(await setAllowed()) } catch { /* not fatal */ }
        const res = unwrap(await requestAccess())
        if (!res?.address) throw new Error('No address returned by Freighter')
        setAddress(res.address)
        localStorage.setItem(STORAGE_KEY, '1')
        try {
            const net = unwrap(await getNetwork())
            if (net?.network) setNetwork(net.network)
        } catch { /* keep default */ }
    }, [])

    const disconnect = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY)
        setAddress(null)
    }, [])

    return (
        <FreighterCtx.Provider value={{ address, network, ready, connect, disconnect }}>
            {children}
        </FreighterCtx.Provider>
    )
}

export function useFreighter(): Ctx {
    const ctx = useContext(FreighterCtx)
    if (!ctx) throw new Error('useFreighter must be used inside FreighterProvider')
    return ctx
}

export default FreighterProvider
