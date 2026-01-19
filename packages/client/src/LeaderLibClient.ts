/**
 * @fileoverview LeaderLib Client SDK
 *
 * High-level client for interacting with LeaderLib leaderboards on the BSV blockchain.
 * Provides methods for submitting scores, querying leaderboards, and creating new leaderboards.
 *
 * @example Basic usage - Submit a score
 * ```typescript
 * import { leaderboard } from '@leaderlib/client'
 *
 * const lb = leaderboard('my-game-leaderboard', {
 *   signerUrl: 'https://my-attestation-server.com'
 * })
 *
 * await lb.submit({ playerId: 'player123', score: 1000 })
 * const topPlayers = await lb.getTop(10)
 * ```
 *
 * @example Admin usage - Create a leaderboard with dedicated attestation key
 * ```typescript
 * import { LeaderLibAdmin } from '@leaderlib/client'
 * import { ProtoWallet, PrivateKey } from '@bsv/sdk'
 *
 * // Generate a dedicated key pair for attestations
 * const attestationPrivKey = PrivateKey.fromRandom()
 * const attestationPubKey = attestationPrivKey.toPublicKey().toString()
 *
 * // Create leaderboard with wallet identity, but use attestation key for scoring
 * const admin = new LeaderLibAdmin({ 
 *   attestationPublicKey: attestationPubKey 
 * })
 * await admin.createLeaderboard('my-game-leaderboard', {
 *   sortOrder: 'desc',
 *   maxEntriesPerPlayer: 1
 * })
 *
 * // Store attestationPrivKey securely for your attestation server
 * ```
 *
 * @module @leaderlib/client
 */

import {
  Transaction,
  PushDrop,
  WalletInterface,
  WalletClient,
  LookupResolver,
  TopicBroadcaster
} from '@bsv/sdk'
import {
  LeaderboardDefinition,
  LeaderboardSubmission,
  LeaderboardEntry,
  LeaderboardRules,
  AttestationRequest,
  AttestationResponse,
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  TOPIC_NAME,
  LOOKUP_SERVICE_NAME,
  hashRules,
  generateNonce,
  getDefinitionFields,
  getSubmissionFields,
  canonicalizeDefinition,
  parseLeaderLibScript
} from '@leaderlib/core'

/**
 * Configuration options for LeaderLibClient.
 */
export interface LeaderLibClientOptions {
  /**
   * BSV wallet instance for signing transactions.
   * Defaults to WalletClient() if not provided.
   */
  wallet?: WalletInterface

  /**
   * URL of the publisher's attestation server.
   * Required for submitting scores to publisher-attested leaderboards.
   * @example 'https://my-game.com/api/attestation'
   */
  signerUrl?: string

  /**
   * Overlay host URL for the LeaderLib network.
   * @default 'https://overlay.leaderlib.io'
   */
  overlayHost?: string

  /**
   * Network preset for overlay connectivity.
   * @default 'mainnet'
   */
  networkPreset?: 'local' | 'mainnet'
}

/**
 * Options for submitting a score to a leaderboard.
 */
export interface SubmitScoreOptions {
  /** Unique identifier for the player (e.g., identity key, username, or game-specific ID) */
  playerId: string

  /** The score value to submit (must be a positive integer) */
  score: number
}

/**
 * Options for paginated leaderboard queries.
 */
export interface GetLeaderboardOptions {
  /**
   * Maximum number of entries to return.
   * @default 50
   */
  limit?: number

  /**
   * Pagination cursor from a previous query.
   * Used to fetch the next page of results.
   */
  cursor?: string
}

/**
 * Client for interacting with a specific LeaderLib leaderboard.
 * Provides methods for submitting scores, querying top players, and player rank lookup.
 */
export class LeaderLibClient {
  private readonly wallet: WalletInterface
  private readonly signerUrl?: string
  private readonly overlayHost: string
  private readonly lookupResolver: LookupResolver
  private readonly topicBroadcaster: TopicBroadcaster
  private readonly leaderboardId: string
  private readonly pushdrop: PushDrop

  /**
   * Creates a new LeaderLibClient instance.
   *
   * @param leaderboardId - Unique identifier for the leaderboard to interact with
   * @param options - Configuration options
   */
  constructor(leaderboardId: string, options: LeaderLibClientOptions = {}) {
    if (!leaderboardId || typeof leaderboardId !== 'string') {
      throw new Error('leaderboardId is required and must be a non-empty string')
    }

    this.leaderboardId = leaderboardId
    this.wallet = options.wallet ?? new WalletClient()
    this.signerUrl = options.signerUrl
    this.overlayHost = options.overlayHost ?? 'https://overlay.leaderlib.io'

    const networkPreset = options.networkPreset ?? 'mainnet'
    this.lookupResolver = new LookupResolver({ networkPreset })
    this.topicBroadcaster = new TopicBroadcaster([TOPIC_NAME], { networkPreset })
    this.pushdrop = new PushDrop(this.wallet)
  }

  /**
   * Submits a score to the leaderboard.
   * Requests attestation, creates on-chain transaction, and broadcasts to overlay.
   *
   * @param options - Score submission options
   * @returns Object containing the transaction ID
   * @throws Error if signerUrl is not configured or attestation fails
   */
  async submit(options: SubmitScoreOptions): Promise<{ txid: string }> {
    const { playerId, score } = options

    if (!playerId || typeof playerId !== 'string') {
      throw new Error('playerId is required and must be a non-empty string')
    }
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      throw new Error('score must be a finite number')
    }

    const nonce = generateNonce()

    const attestation = await this.fetchAttestation({
      leaderboardId: this.leaderboardId,
      playerId,
      score,
      nonce
    })

    const submission: LeaderboardSubmission = {
      protocol: PROTOCOL_NAME,
      version: PROTOCOL_VERSION,
      type: 'leaderboard-submission',
      leaderboardId: this.leaderboardId,
      playerId,
      score,
      nonce,
      expiresAt: attestation.expiresAt,
      submittedAt: Date.now(),
      publisherAttestation: attestation.attestation
    }

    const fields = getSubmissionFields(submission)
    const lockingScript = await this.pushdrop.lock(
      fields,
      [2, 'leaderlib'],
      this.leaderboardId,
      'anyone',
      false,
      true
    )

    const createResult = await this.wallet.createAction({
      description: `Submit score ${score} to ${this.leaderboardId}`,
      outputs: [{
        lockingScript: lockingScript.toHex(),
        satoshis: 1,
        outputDescription: 'LeaderLib score submission'
      }]
    })

    if (!createResult.txid || !createResult.tx) {
      throw new Error('Failed to create transaction')
    }

    // Broadcast to the overlay
    const tx = Transaction.fromAtomicBEEF(createResult.tx)
    await this.topicBroadcaster.broadcast(tx)

    return { txid: createResult.txid }
  }

  /**
   * Retrieves the top N players from the leaderboard.
   * @param n - Number of top entries to retrieve (default: 10, max: 100)
   * @returns Array of leaderboard entries sorted by score
   */
  async getTop(n: number = 10): Promise<LeaderboardEntry[]> {
    const limit = Math.min(Math.max(1, n), 100)

    const result = await this.lookupResolver.query({
      service: LOOKUP_SERVICE_NAME,
      query: {
        getTopN: {
          leaderboardId: this.leaderboardId,
          n: limit
        }
      }
    })

    return this.parseLeaderboardResults(result)
  }

  /**
   * Retrieves a paginated list of leaderboard entries.
   * @param options - Pagination options (limit, cursor)
   * @returns Object containing entries, pagination cursor, and hasMore flag
   */
  async getLeaderboard(options: GetLeaderboardOptions = {}): Promise<{
    entries: LeaderboardEntry[]
    cursor?: string
    hasMore: boolean
  }> {
    const limit = Math.min(Math.max(1, options.limit ?? 50), 100)
    const { cursor } = options

    const result = await this.lookupResolver.query({
      service: LOOKUP_SERVICE_NAME,
      query: {
        getLeaderboard: {
          leaderboardId: this.leaderboardId,
          limit,
          cursor
        }
      }
    })

    const entries = this.parseLeaderboardResults(result)
    const metadata = (result as { metadata?: { nextCursor?: string; hasMore?: boolean } }).metadata

    return {
      entries,
      cursor: metadata?.nextCursor,
      hasMore: metadata?.hasMore ?? false
    }
  }

  /**
   * Gets a specific player's rank and entry on the leaderboard.
   * @param playerId - The player's unique identifier
   * @returns Object containing rank (1-indexed, or -1 if not found) and entry details
   */
  async getPlayerRank(playerId: string): Promise<{
    rank: number
    entry: LeaderboardEntry | null
  }> {
    if (!playerId || typeof playerId !== 'string') {
      throw new Error('playerId is required and must be a non-empty string')
    }

    const result = await this.lookupResolver.query({
      service: LOOKUP_SERVICE_NAME,
      query: {
        getPlayerRank: {
          leaderboardId: this.leaderboardId,
          playerId
        }
      }
    })

    const typedResult = result as {
      outputs?: unknown[]
      metadata?: { rank?: number }
    }

    if (!typedResult.outputs || typedResult.outputs.length === 0) {
      return { rank: -1, entry: null }
    }

    const entries = this.parseLeaderboardResults(result)
    return {
      rank: typedResult.metadata?.rank ?? -1,
      entry: entries[0] ?? null
    }
  }

  /**
   * Fetches an attestation from the publisher's signer server.
   * @internal
   */
  private async fetchAttestation(request: AttestationRequest): Promise<AttestationResponse> {
    if (!this.signerUrl) {
      throw new Error(
        'signerUrl is required for score submission. ' +
        'Configure it when creating the LeaderLibClient instance.'
      )
    }

    const url = `${this.signerUrl}/attest`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
    } catch (error) {
      throw new Error(
        `Failed to connect to attestation server at ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Attestation failed (${response.status}): ${errorText}`)
    }

    return response.json() as Promise<AttestationResponse>
  }

  /**
   * Parses overlay query results into LeaderboardEntry objects.
   * @internal
   */
  private parseLeaderboardResults(result: unknown): LeaderboardEntry[] {
    const typedResult = result as {
      outputs?: Array<{ beef: number[]; outputIndex: number }>
    }

    if (!typedResult.outputs || !Array.isArray(typedResult.outputs)) {
      return []
    }

    const entries: LeaderboardEntry[] = []

    for (const output of typedResult.outputs) {
      try {
        const tx = Transaction.fromBEEF(output.beef)
        const txOutput = tx.outputs[output.outputIndex]
        if (!txOutput) continue

        const parsed = parseLeaderLibScript(txOutput.lockingScript)
        if (!parsed || parsed.type !== 'submission') continue

        const submission = parsed.data as LeaderboardSubmission
        entries.push({
          playerId: submission.playerId,
          score: submission.score,
          submittedAt: submission.submittedAt,
          txid: tx.id('hex'),
          outputIndex: output.outputIndex
        })
      } catch {
        // Skip malformed outputs - don't break the entire query
        continue
      }
    }

    return entries
  }
}

/**
 * Configuration options for LeaderLibAdmin.
 */
export interface LeaderLibAdminOptions {
  /**
   * BSV wallet instance (WalletClient, ProtoWallet, CompletedProtoWallet, etc.).
   * Uses wallet's identity key for signing leaderboard definitions.
   * Defaults to WalletClient() if not provided.
   */
  wallet?: WalletInterface

  /**
   * Optional attestation public key (hex format).
   * If provided, this key will be used as the publisherPubKey in the leaderboard definition.
   * The corresponding private key must be used by the attestation server to sign score attestations.
   * If not provided, defaults to the wallet's identity key.
   * 
   * Use this to separate leaderboard creation (signed with wallet identity) from
   * score attestation (signed with a dedicated attestation key).
   */
  attestationPublicKey?: string

  /**
   * Network preset for overlay connectivity.
   * @default 'mainnet'
   */
  networkPreset?: 'local' | 'mainnet'
}

/**
 * Admin client for creating and managing LeaderLib leaderboards.
 * Uses any WalletInterface implementation for signing (WalletClient, ProtoWallet, etc.).
 */
export class LeaderLibAdmin {
  private readonly wallet: WalletInterface
  private readonly pushdrop: PushDrop
  private readonly topicBroadcaster: TopicBroadcaster
  private readonly attestationPublicKey?: string
  private cachedIdentityKey?: string

  /**
   * Creates a new LeaderLibAdmin instance.
   * @param options - Configuration options including wallet and optional attestation key
   */
  constructor(options: LeaderLibAdminOptions = {}) {
    this.wallet = options.wallet ?? new WalletClient()
    this.attestationPublicKey = options.attestationPublicKey
    const networkPreset = options.networkPreset ?? 'mainnet'
    this.topicBroadcaster = new TopicBroadcaster([TOPIC_NAME], { networkPreset })
    this.pushdrop = new PushDrop(this.wallet)
  }

  /**
   * Gets the wallet's identity key (used for signing leaderboard creation transactions).
   */
  async getIdentityKey(): Promise<string> {
    if (this.cachedIdentityKey) {
      return this.cachedIdentityKey
    }
    const { publicKey } = await this.wallet.getPublicKey({ identityKey: true })
    this.cachedIdentityKey = publicKey
    return this.cachedIdentityKey
  }

  /**
   * Gets the attestation public key to be used in the leaderboard definition.
   * Returns the provided attestationPublicKey if set, otherwise falls back to wallet's identity key.
   */
  async getAttestationPublicKey(): Promise<string> {
    if (this.attestationPublicKey) {
      return this.attestationPublicKey
    }
    return this.getIdentityKey()
  }

  /**
   * Creates a new leaderboard on-chain.
   * Signs definition with publisher key and broadcasts to overlay.
   *
   * @param leaderboardId - Unique identifier for the leaderboard
   * @param rules - Optional rules configuration
   * @returns Object containing the transaction ID and full definition
   */
  async createLeaderboard(
    leaderboardId: string,
    rules: LeaderboardRules = {}
  ): Promise<{ txid: string; definition: LeaderboardDefinition }> {
    if (!leaderboardId || typeof leaderboardId !== 'string') {
      throw new Error('leaderboardId is required and must be a non-empty string')
    }

    // Get attestation public key (either provided or wallet's identity key)
    const publisherPubKey = await this.getAttestationPublicKey()
    const rulesHash = hashRules(rules)
    const createdAt = Date.now()

    // Sign the leaderboard definition using wallet's identity key
    const message = canonicalizeDefinition(leaderboardId, publisherPubKey, rulesHash, createdAt)
    const messageBytes = new TextEncoder().encode(message)
    const { signature: sig } = await this.wallet.createSignature({
      data: Array.from(messageBytes),
      protocolID: [2, 'leaderlib attestation'],
      keyID: '1'
    })
    const signature = sig.map(b => b.toString(16).padStart(2, '0')).join('')

    const definition: LeaderboardDefinition = {
      protocol: PROTOCOL_NAME,
      version: PROTOCOL_VERSION,
      type: 'leaderboard-definition',
      leaderboardId,
      publisherPubKey,
      rules,
      rulesHash,
      createdAt,
      signature
    }

    const fields = getDefinitionFields(definition)
    const lockingScript = await this.pushdrop.lock(
      fields,
      [2, 'leaderlib'],
      leaderboardId,
      'anyone',
      false,
      true
    )

    const createResult = await this.wallet.createAction({
      description: `Create leaderboard: ${leaderboardId}`,
      outputs: [{
        lockingScript: lockingScript.toHex(),
        satoshis: 1,
        outputDescription: 'LeaderLib leaderboard definition'
      }]
    })

    if (!createResult.txid || !createResult.tx) {
      throw new Error('Failed to create leaderboard transaction')
    }

    // Broadcast to the overlay
    const tx = Transaction.fromAtomicBEEF(createResult.tx)
    await this.topicBroadcaster.broadcast(tx)

    return { txid: createResult.txid, definition }
  }
}

/**
 * Factory function for creating a LeaderLibClient instance.
 *
 * This is a convenience function that provides a more fluent API.
 *
 * @param id - Leaderboard identifier
 * @param options - Client configuration options
 * @returns A new LeaderLibClient instance
 *
 * @example
 * ```typescript
 * import { leaderboard } from '@leaderlib/client'
 *
 * const scores = await leaderboard('my-game', {
 *   signerUrl: 'https://api.my-game.com'
 * }).getTop(10)
 * ```
 */
export function leaderboard(id: string, options: LeaderLibClientOptions = {}): LeaderLibClient {
  return new LeaderLibClient(id, options)
}
