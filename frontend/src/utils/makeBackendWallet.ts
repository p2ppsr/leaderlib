import {
  Chain,
  Wallet,
  WalletSigner,
  WalletStorageManager,
  StorageClient,
  Services,
  PrivilegedKeyManager,
  createDefaultWalletServicesOptions
} from '@bsv/wallet-toolbox-client'
import { WalletInterface, KeyDeriver, PrivateKey } from '@bsv/sdk'

const walletServices: Map<Chain, Services | undefined> = new Map()
const pendingInitializations: Map<Chain, Promise<Services>> = new Map()

async function getWalletServices(chain: Chain): Promise<Services> {
  const pending = pendingInitializations.get(chain)
  if (pending) {
    return pending
  }
  let s = walletServices.get(chain)
  if (!s) {
    const initPromise = (async () => {
      try {
        const serviceOptions = createDefaultWalletServicesOptions(chain)
        s = new Services(serviceOptions)
        walletServices.set(chain, s)
        return s
      } finally {
        pendingInitializations.delete(chain)
      }
    })()
    pendingInitializations.set(chain, initPromise)
    return initPromise
  }
  return s
}

export interface BackendWalletResult {
  wallet: WalletInterface
  identityKey: string
}

/**
 * Creates a backend wallet from a private key.
 * This wallet can be used for createAction and other wallet operations.
 */
export async function makeBackendWallet(
  privateKeyHex: string,
  chain: 'main' | 'test' = 'main',
  storageURL: string = 'https://storage.babbage.systems'
): Promise<BackendWalletResult> {
  const keyDeriver = new KeyDeriver(new PrivateKey(privateKeyHex, 'hex'))
  const identityKey = keyDeriver.identityKey
  const storageManager = new WalletStorageManager(identityKey)
  const signer = new WalletSigner(chain, keyDeriver, storageManager)
  const services = await getWalletServices(chain)

  const wallet = new Wallet(signer, services, undefined, new PrivilegedKeyManager(async (reason) => {
    const key = window.prompt(
      `Privileged key requested for: ${reason}\n\nPaste your privileged key in hex (or cancel for random):`
    )
    if (!key) {
      return PrivateKey.fromRandom()
    }
    return new PrivateKey(key, 'hex')
  }))

  const client = new StorageClient(wallet, storageURL)
  await client.makeAvailable()
  await storageManager.addWalletStorageProvider(client)

  return { wallet, identityKey }
}

/**
 * Gets the identity public key from a private key without creating a full wallet.
 */
export function getIdentityKeyFromPrivate(privateKeyHex: string): string {
  const keyDeriver = new KeyDeriver(new PrivateKey(privateKeyHex, 'hex'))
  return keyDeriver.identityKey
}
