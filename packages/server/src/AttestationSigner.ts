/**
 * @fileoverview LeaderLib Attestation Signer
 *
 * Server-side component for signing score attestations.
 * Used by game publishers to authorize player score submissions.
 *
 * @module @leaderlib/server
 */

import { PrivateKey, ProtoWallet } from '@bsv/sdk'
import {
  AttestationRequest,
  AttestationResponse,
  signAttestation,
  createProtoWalletFromHex
} from '@leaderlib/core'

/**
 * Configuration options for the AttestationSigner.
 */
export interface AttestationSignerOptions {
  /** Publisher's private key in hexadecimal format. Keep secret. */
  privateKeyHex: string

  /** Time in milliseconds until attestations expire. @default 300000 (5 minutes) */
  expirationMs?: number

  /** Optional custom validation function. Return true to allow, false to reject. */
  validateScore?: (request: AttestationRequest) => Promise<boolean> | boolean
}

/**
 * Signs attestations for player score submissions.
 * Core component of a LeaderLib attestation server.
 */
export class AttestationSigner {
  private readonly wallet: ProtoWallet
  private readonly privateKey: PrivateKey
  private readonly expirationMs: number
  private readonly validateScore?: (request: AttestationRequest) => Promise<boolean> | boolean

  /**
   * Creates a new AttestationSigner instance.
   *
   * @param options - Configuration options
   * @throws Error if privateKeyHex is invalid
   */
  constructor(options: AttestationSignerOptions) {
    if (!options.privateKeyHex || typeof options.privateKeyHex !== 'string') {
      throw new Error('privateKeyHex is required')
    }

    this.privateKey = new PrivateKey(options.privateKeyHex, 'hex')
    this.wallet = createProtoWalletFromHex(options.privateKeyHex)
    this.expirationMs = options.expirationMs ?? 5 * 60 * 1000 // 5 minutes default
    this.validateScore = options.validateScore
  }

  /**
   * The publisher's public key derived from the private key.
   * This is included in attestation logs and can be used to verify signatures.
   */
  get publicKey(): string {
    return this.privateKey.toPublicKey().toString()
  }

  /**
   * Creates an attestation for a score submission request.
   *
   * This method:
   * 1. Validates the request structure
   * 2. Runs optional custom validation (if configured)
   * 3. Signs the attestation with the publisher's private key
   * 4. Logs the attestation for auditing
   *
   * @param request - The attestation request from a client
   * @returns Signed attestation response with expiration time
   * @throws Error if request validation fails
   * @throws Error if custom validateScore returns false
   */
  async attest(request: AttestationRequest): Promise<AttestationResponse> {
    // Validate request structure
    if (!request.leaderboardId || typeof request.leaderboardId !== 'string') {
      throw new Error('Invalid leaderboardId: must be a non-empty string')
    }
    if (!request.playerId || typeof request.playerId !== 'string') {
      throw new Error('Invalid playerId: must be a non-empty string')
    }
    if (typeof request.score !== 'number' || !Number.isFinite(request.score)) {
      throw new Error('Invalid score: must be a finite number')
    }
    if (!request.nonce || typeof request.nonce !== 'string') {
      throw new Error('Invalid nonce: must be a non-empty string')
    }

    // Run custom validation if configured
    if (this.validateScore) {
      const isValid = await this.validateScore(request)
      if (!isValid) {
        throw new Error('Score validation failed: custom validator rejected the request')
      }
    }

    const expiresAt = Date.now() + this.expirationMs

    const attestation = await signAttestation(
      this.wallet,
      request.leaderboardId,
      request.playerId,
      request.score,
      request.nonce,
      expiresAt
    )

    // Log attestation details
    console.log('Attestation created:', {
      timestamp: new Date().toISOString(),
      leaderboardId: request.leaderboardId,
      playerId: request.playerId,
      score: request.score,
      nonce: request.nonce.slice(0, 8) + '...',
      expiresAt: new Date(expiresAt).toISOString(),
      publisherPubKey: this.publicKey
    })

    return {
      attestation,
      expiresAt
    }
  }
}
