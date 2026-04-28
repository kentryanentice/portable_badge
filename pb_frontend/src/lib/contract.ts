// ─── Stellar explorer helpers ───────────────────────────────────────────────
// All Soroban contract calls happen on the backend (pb_engine). The frontend
// only needs to know which network to link transaction hashes against.

export const NETWORK =
    (import.meta.env.VITE_STELLAR_NETWORK ?? 'TESTNET') as 'TESTNET' | 'PUBLIC'

const EXPLORER_BASE =
    NETWORK === 'PUBLIC'
        ? 'https://stellar.expert/explorer/public'
        : 'https://stellar.expert/explorer/testnet'

export const EXPLORER_TX      = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`
export const EXPLORER_CONTRACT = (id: string)  => `${EXPLORER_BASE}/contract/${id}`
export const EXPLORER_ACCOUNT  = (addr: string) => `${EXPLORER_BASE}/account/${addr}`
