/**
 * @fileoverview LeaderLib Core Types
 *
 * This module defines the core data structures and constants used throughout
 * the LeaderLib protocol for tamper-resistant, publisher-authoritative leaderboards
 * on the BSV blockchain.
 *
 * @module @leaderlib/core
 */

/** Protocol identifier used in all LeaderLib on-chain records */
export const PROTOCOL_NAME = 'leaderlib'

/** Current protocol version number */
export const PROTOCOL_VERSION = 1

/** Topic manager name for LeaderLib overlay network */
export const TOPIC_NAME = 'tm_leaderlib'

/** Lookup service name for querying leaderboard data */
export const LOOKUP_SERVICE_NAME = 'ls_leaderlib'

/** Discriminated union type for on-chain record types */
export type LeaderboardRecordType = 'leaderboard-definition' | 'leaderboard-submission'

/**
 * On-chain record that defines a leaderboard.
 *
 * Created by publishers to establish a new leaderboard with specific rules.
 * The definition is signed by the publisher's private key to prove authenticity.
 */
export interface LeaderboardDefinition {
  /** Protocol identifier (always 'leaderlib') */
  protocol: typeof PROTOCOL_NAME

  /** Protocol version number */
  version: typeof PROTOCOL_VERSION

  /** Record type discriminator */
  type: 'leaderboard-definition'

  /** Unique identifier for the leaderboard */
  leaderboardId: string

  /** Publisher's public key in hex format */
  publisherPubKey: string

  /** Rules configuration for the leaderboard */
  rules: LeaderboardRules

  /** SHA-256 hash of the canonical rules JSON */
  rulesHash: string

  /** Unix timestamp (ms) when the leaderboard was created */
  createdAt: number

  /** Publisher's signature over the definition (hex) */
  signature: string
}

/**
 * On-chain record representing a score submission.
 *
 * Created by players to submit a score that has been attested by the publisher.
 * The attestation proves the score was validated by the game server.
 */
export interface LeaderboardSubmission {
  /** Protocol identifier (always 'leaderlib') */
  protocol: typeof PROTOCOL_NAME

  /** Protocol version number */
  version: typeof PROTOCOL_VERSION

  /** Record type discriminator */
  type: 'leaderboard-submission'

  /** ID of the leaderboard this score belongs to */
  leaderboardId: string

  /** Unique identifier for the player */
  playerId: string

  /** The score value */
  score: number

  /** Unique nonce to prevent replay attacks */
  nonce: string

  /** Unix timestamp (ms) when the attestation expires */
  expiresAt: number

  /** Unix timestamp (ms) when the score was submitted on-chain */
  submittedAt: number

  /** Publisher's attestation signature (hex) */
  publisherAttestation: string
}

/**
 * Configuration rules for a leaderboard.
 *
 * All fields are optional. Rules are hashed and stored on-chain
 * to ensure immutability after creation.
 */
export interface LeaderboardRules {
  /** Human-readable name for the leaderboard */
  name?: string

  /** Description of the leaderboard or game */
  description?: string

  /** Maximum allowed score value */
  maxScore?: number

  /** Minimum allowed score value */
  minScore?: number

  /**
   * Sort order for ranking players.
   * - 'desc': Higher scores rank higher (default for most games)
   * - 'asc': Lower scores rank higher (e.g., speedruns, golf)
   */
  sortOrder?: 'asc' | 'desc'

  /**
   * Maximum number of entries per player.
   * Set to 1 to keep only each player's best score.
   */
  maxEntriesPerPlayer?: number

  /** Whether anonymous submissions are allowed */
  allowAnonymous?: boolean

  /** Additional custom metadata */
  metadata?: Record<string, unknown>
}

/**
 * A single entry on a leaderboard, as returned by lookup queries.
 */
export interface LeaderboardEntry {
  /** Player's unique identifier */
  playerId: string

  /** The player's score */
  score: number

  /** Unix timestamp (ms) when submitted */
  submittedAt: number

  /** Transaction ID containing the submission */
  txid: string

  /** Output index within the transaction */
  outputIndex: number

  /** Player's rank on the leaderboard (1-indexed, if available) */
  rank?: number
}

/**
 * Summary information about a leaderboard, as returned by lookup queries.
 */
export interface LeaderboardInfo {
  /** Unique identifier for the leaderboard */
  leaderboardId: string

  /** Publisher's public key in hex format */
  publisherPubKey: string

  /** SHA-256 hash of the canonical rules JSON */
  rulesHash: string

  /** Unix timestamp (ms) when created */
  createdAt: number

  /** Transaction ID containing the definition */
  txid: string

  /** Output index within the transaction */
  outputIndex: number
}

/**
 * Request payload for the attestation server's `/attest` endpoint.
 */
export interface AttestationRequest {
  /** ID of the leaderboard */
  leaderboardId: string

  /** Player's unique identifier */
  playerId: string

  /** Score to be attested */
  score: number

  /** Unique nonce generated by the client */
  nonce: string
}

/**
 * Response from the attestation server's `/attest` endpoint.
 */
export interface AttestationResponse {
  /** Publisher's signature over the score data (hex) */
  attestation: string

  /** Unix timestamp (ms) when this attestation expires */
  expiresAt: number
}
