const b64 = (src: ArrayBuffer | Uint8Array): string => {
  const bytes = src instanceof Uint8Array ? src : new Uint8Array(src)
  let s = ''
  bytes.forEach(b => { s += String.fromCharCode(b) })
  return btoa(s)
}

async function sign(data: object) {
  const key = await crypto.subtle.generateKey(
    { name: 'Ed25519' } as AlgorithmIdentifier,
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair

  const msg = new TextEncoder().encode(JSON.stringify(data))
  const [sig, pub] = await Promise.all([
    crypto.subtle.sign('Ed25519', key.privateKey, msg),
    crypto.subtle.exportKey('raw', key.publicKey),
  ])

  return { payload: b64(msg), pubkey: b64(pub), signature: b64(sig) }
}

export async function request(url: string, data: object): Promise<Response | null> {
  const body = await sign({
    ...data,
    nonce:          b64(crypto.getRandomValues(new Uint8Array(16))),
    ingress_expiry: Date.now() + 5 * 60 * 1000,
  })

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  }).catch(() => null)
}
