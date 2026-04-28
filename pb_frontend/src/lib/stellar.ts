// Builds, signs (via Freighter), and submits a credit-purchase payment to
// the treasury. The resulting tx hash is the on-chain audit trail — handed
// to the backend, which verifies via Horizon and credits the wallet.

import {
    Asset,
    BASE_FEE,
    Horizon,
    Memo,
    Networks,
    Operation,
    TransactionBuilder,
} from '@stellar/stellar-sdk'
import { signTransaction } from '@stellar/freighter-api'

import { NETWORK } from './contract'

const HORIZON_URL =
    NETWORK === 'PUBLIC'
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org'

const NETWORK_PASSPHRASE =
    NETWORK === 'PUBLIC' ? Networks.PUBLIC : Networks.TESTNET

export type PurchaseErrorCode = 'horizon' | 'freighter' | 'submit' | 'network'

export class PurchaseError extends Error {
    readonly code: PurchaseErrorCode
    constructor(message: string, code: PurchaseErrorCode) {
        super(message)
        this.code = code
    }
}

/// 1 XLM = 10_000_000 stroops. Horizon expects amounts as decimal strings
/// with up to 7 decimal places.
export function stroopsToXlm(stroops: number | string): string {
    const n = typeof stroops === 'string' ? BigInt(stroops) : BigInt(Math.trunc(stroops))
    const whole = n / 10_000_000n
    const frac  = (n % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '')
    return frac.length ? `${whole}.${frac}` : `${whole}`
}

/// Builds a classic XLM payment, asks Freighter to sign it, submits to
/// Horizon, returns the tx hash. Throws PurchaseError on any failure with
/// a code so the UI can show a useful message.
export async function payTreasury(args: {
    fromAddress: string
    treasury:    string
    stroops:     number | string
    memo:        string  // typically `${plan_id}|${receipt_id}`
}): Promise<string> {
    const server = new Horizon.Server(HORIZON_URL)

    let account
    try {
        account = await server.loadAccount(args.fromAddress)
    } catch (e) {
        throw new PurchaseError(
            (e as Error)?.message ?? 'Failed to load account from Horizon',
            'horizon',
        )
    }

    const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(Operation.payment({
            destination: args.treasury,
            asset:       Asset.native(),
            amount:      stroopsToXlm(args.stroops),
        }))
        .addMemo(Memo.text(args.memo.slice(0, 28)))
        .setTimeout(180)
        .build()

    let signedXdr: string
    try {
        const res = await signTransaction(tx.toXDR(), {
            networkPassphrase: NETWORK_PASSPHRASE,
            address:           args.fromAddress,
        })
        if (res.error) throw new Error(typeof res.error === 'string' ? res.error : 'Freighter declined')
        signedXdr = res.signedTxXdr
    } catch (e) {
        throw new PurchaseError(
            (e as Error)?.message ?? 'Wallet signature failed',
            'freighter',
        )
    }

    const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
    try {
        const result = await server.submitTransaction(signed) as { hash: string }
        return result.hash
    } catch (e) {
        const err = e as { response?: { data?: { extras?: { result_codes?: unknown } } }; message?: string }
        const codes = err.response?.data?.extras?.result_codes
        const detail = codes ? JSON.stringify(codes) : err.message ?? 'Submission failed'
        throw new PurchaseError(detail, 'submit')
    }
}
