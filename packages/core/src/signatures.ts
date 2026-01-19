/**
 * @fileoverview LeaderLib Signature Utilities
 *
 * Provides cryptographic signing and verification functions for LeaderLib.
 * Uses BSV wallet protocol signatures with security level 2 (application level).
 *
 * @module @leaderlib/core
 */

import { PrivateKey, ProtoWallet, Utils, Random, WalletProtocol } from '@bsv/sdk'
import { canonicalizeDefinition, canonicalizeSubmission } from './serialization.js'

/**
 * Wallet protocol identifier for LeaderLib signatures.
 * Security level 2 indicates application-level signing.
 */
const LEADERLIB_PROTOCOL: WalletProtocol = [2, 'leaderlib attestation']

/** Key ID used for all LeaderLib signatures */
const LEADERLIB_KEY_ID = '1'

/**
 * Signs a leaderboard definition with the publisher's wallet.
 *
 * @param wallet - ProtoWallet instance containing the publisher's private key
 * @param leaderboardId - Unique identifier for the leaderboard
 * @param publisherPubKey - Publisher's public key in hex format
 * @param rulesHash - SHA-256 hash of the canonical rules JSON
 * @param createdAt - Unix timestamp (ms) of creation
 * @returns Signature as a hex string
 */
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

/**
 * Verifies a leaderboard definition signature.
 *
 * @param verifierWallet - ProtoWallet instance for verification
 * @param signature - Signature to verify (hex string)
 * @param leaderboardId - Leaderboard ID from the definition
 * @param publisherPubKey - Publisher's public key (hex)
 * @param rulesHash - Rules hash from the definition
 * @param createdAt - Creation timestamp from the definition
 * @returns True if signature is valid, false otherwise
 */
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

/**
 * Signs a score attestation with the publisher's wallet.
 *
 * Called by the attestation server to approve a player's score submission.
 * The signature includes the nonce and expiration to prevent replay attacks.
 *
 * @param wallet - ProtoWallet instance containing the publisher's private key
 * @param leaderboardId - ID of the leaderboard
 * @param playerId - Player's unique identifier
 * @param score - Score value being attested
 * @param nonce - Unique nonce from the client
 * @param expiresAt - Expiration timestamp for this attestation
 * @returns Attestation signature as a hex string
 */
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

/**
 * Verifies a score attestation signature.
 *
 * Used by the topic manager to validate that a score was properly
 * attested by the leaderboard publisher before admitting it to the overlay.
 *
 * @param verifierWallet - ProtoWallet instance for verification
 * @param attestation - Attestation signature to verify (hex)
 * @param publisherPubKey - Publisher's public key (hex)
 * @param leaderboardId - ID of the leaderboard
 * @param playerId - Player's unique identifier
 * @param score - Score value from the submission
 * @param nonce - Nonce from the submission
 * @param expiresAt - Expiration timestamp from the submission
 * @returns True if attestation is valid, false otherwise
 */
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

/**
 * Generates a cryptographically secure random nonce.
 *
 * Used by clients to ensure each attestation request is unique
 * and cannot be replayed.
 *
 * @returns 16-byte random nonce as a hex string (32 characters)
 */
export function generateNonce(): string {
  const bytes = Random(16)
  return Utils.toHex(bytes)
}

/**
 * Generates a new random key pair for a publisher.
 * @returns Object containing private key and public key as hex strings
 */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const privKey = PrivateKey.fromRandom()
  return {
    privateKey: Utils.toHex(privKey.toArray()),
    publicKey: privKey.toPublicKey().toString()
  }
}

/**
 * Creates a ProtoWallet instance from a hex-encoded private key.
 * @param privateKeyHex - Private key in hexadecimal format
 * @returns ProtoWallet instance for signing operations
 */
export function createProtoWalletFromHex(privateKeyHex: string): ProtoWallet {
  return new ProtoWallet(new PrivateKey(privateKeyHex, 'hex'))
}
