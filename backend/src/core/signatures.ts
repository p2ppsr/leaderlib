import { PrivateKey, ProtoWallet, Utils, Random, WalletProtocol } from '@bsv/sdk'
import { canonicalizeDefinition, canonicalizeSubmission } from './serialization.js'

// Protocol for LeaderLib signatures (SecurityLevel 2 = app level)
const LEADERLIB_PROTOCOL: WalletProtocol = [2, 'leaderlib attestation']
const LEADERLIB_KEY_ID = '1'

export async function signDefinition(
  wallet: ProtoWallet,
  leaderboardId: string,
  publisherPubKey: string,
  rulesHash: string,
  createdAt: number
): Promise<string> {
  const message = canonicalizeDefinition(leaderboardId, publisherPubKey, rulesHash, createdAt)
  const messageBytes = Utils.toArray(message, 'utf8')

  const { signature } = await wallet.createSignature({
    protocolID: LEADERLIB_PROTOCOL,
    keyID: LEADERLIB_KEY_ID,
    data: messageBytes
  })

  return Utils.toHex(signature)
}

export async function verifyDefinitionSignature(
  verifierWallet: ProtoWallet,
  signature: string,
  leaderboardId: string,
  publisherPubKey: string,
  rulesHash: string,
  createdAt: number
): Promise<boolean> {
  try {
    const message = canonicalizeDefinition(leaderboardId, publisherPubKey, rulesHash, createdAt)
    const messageBytes = Utils.toArray(message, 'utf8')

    const { valid } = await verifierWallet.verifySignature({
      protocolID: LEADERLIB_PROTOCOL,
      keyID: LEADERLIB_KEY_ID,
      data: messageBytes,
      signature: Utils.toArray(signature, 'hex'),
      counterparty: publisherPubKey
    })

    return valid
  } catch {
    return false
  }
}

export async function signAttestation(
  wallet: ProtoWallet,
  leaderboardId: string,
  playerId: string,
  score: number,
  nonce: string,
  expiresAt: number
): Promise<string> {
  const message = canonicalizeSubmission(leaderboardId, playerId, score, nonce, expiresAt)
  const messageBytes = Utils.toArray(message, 'utf8')

  const { signature } = await wallet.createSignature({
    protocolID: LEADERLIB_PROTOCOL,
    keyID: LEADERLIB_KEY_ID,
    data: messageBytes
  })

  return Utils.toHex(signature)
}

export async function verifyAttestation(
  verifierWallet: ProtoWallet,
  attestation: string,
  publisherPubKey: string,
  leaderboardId: string,
  playerId: string,
  score: number,
  nonce: string,
  expiresAt: number
): Promise<boolean> {
  try {
    const message = canonicalizeSubmission(leaderboardId, playerId, score, nonce, expiresAt)
    const messageBytes = Utils.toArray(message, 'utf8')

    const { valid } = await verifierWallet.verifySignature({
      protocolID: LEADERLIB_PROTOCOL,
      keyID: LEADERLIB_KEY_ID,
      data: messageBytes,
      signature: Utils.toArray(attestation, 'hex'),
      counterparty: publisherPubKey
    })

    return valid
  } catch {
    return false
  }
}

export function generateNonce(): string {
  const bytes = Random(16)
  return Utils.toHex(bytes)
}

export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const privKey = PrivateKey.fromRandom()
  return {
    privateKey: Utils.toHex(privKey.toArray()),
    publicKey: privKey.toPublicKey().toString()
  }
}

export function createProtoWalletFromHex(privateKeyHex: string): ProtoWallet {
  return new ProtoWallet(new PrivateKey(privateKeyHex, 'hex'))
}
