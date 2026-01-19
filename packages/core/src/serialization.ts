/**
 * @fileoverview LeaderLib Serialization Utilities
 *
 * Provides functions for encoding, decoding, and validating LeaderLib
 * data structures. Uses canonical JSON for deterministic serialization.
 *
 * @module @leaderlib/core
 */

import { Utils, Hash } from '@bsv/sdk'
import {
  LeaderboardDefinition,
  LeaderboardSubmission,
  LeaderboardRules,
  PROTOCOL_NAME,
  PROTOCOL_VERSION
} from './types.js'

/**
 * Creates a canonical JSON string for a leaderboard definition.
 *
 * Used for signing to ensure deterministic message format.
 * Keys are sorted alphabetically for consistency.
 *
 * @param leaderboardId - Unique identifier for the leaderboard
 * @param publisherPubKey - Publisher's public key (hex)
 * @param rulesHash - SHA-256 hash of the rules
 * @param createdAt - Creation timestamp (ms)
 * @returns Canonical JSON string
 */
export function canonicalizeDefinition(
  leaderboardId: string,
  publisherPubKey: string,
  rulesHash: string,
  createdAt: number
): string {
  const obj = {
    protocol: PROTOCOL_NAME,
    version: PROTOCOL_VERSION,
    type: 'leaderboard-definition',
    leaderboardId,
    publisherPubKey,
    rulesHash,
    createdAt
  }
  return JSON.stringify(obj, Object.keys(obj).sort())
}

/**
 * Creates a canonical JSON string for a score submission.
 *
 * Used for attestation signing to ensure deterministic message format.
 * Keys are sorted alphabetically for consistency.
 *
 * @param leaderboardId - ID of the leaderboard
 * @param playerId - Player's unique identifier
 * @param score - Score value
 * @param nonce - Unique nonce
 * @param expiresAt - Expiration timestamp (ms)
 * @returns Canonical JSON string
 */
export function canonicalizeSubmission(
  leaderboardId: string,
  playerId: string,
  score: number,
  nonce: string,
  expiresAt: number
): string {
  const obj = {
    leaderboardId,
    playerId,
    score,
    nonce,
    expiresAt
  }
  return JSON.stringify(obj, Object.keys(obj).sort())
}

/**
 * Computes the SHA-256 hash of a rules object.
 * Rules are converted to canonical JSON (sorted keys) for consistent hashing.
 *
 * @param rules - Leaderboard rules configuration
 * @returns SHA-256 hash as a hex string
 */
export function hashRules(rules: LeaderboardRules): string {
  const canonical = JSON.stringify(rules, Object.keys(rules).sort())
  const bytes = Utils.toArray(canonical, 'utf8')
  const hash = Hash.sha256(bytes)
  return Utils.toHex(hash)
}

/**
 * Encodes a leaderboard definition to a byte array.
 *
 * @param definition - The definition to encode
 * @returns UTF-8 encoded JSON as a number array
 */
export function encodeDefinition(definition: LeaderboardDefinition): number[] {
  const json = JSON.stringify(definition)
  return Utils.toArray(json, 'utf8')
}

/**
 * Decodes and validates a leaderboard definition from a byte array.
 *
 * @param data - UTF-8 encoded JSON bytes
 * @returns Validated LeaderboardDefinition object
 * @throws Error if data is invalid or missing required fields
 */
export function decodeDefinition(data: number[]): LeaderboardDefinition {
  const json = Utils.toUTF8(data)
  const parsed = JSON.parse(json)
  validateDefinition(parsed)
  return parsed
}

/**
 * Encodes a leaderboard submission to a byte array.
 *
 * @param submission - The submission to encode
 * @returns UTF-8 encoded JSON as a number array
 */
export function encodeSubmission(submission: LeaderboardSubmission): number[] {
  const json = JSON.stringify(submission)
  return Utils.toArray(json, 'utf8')
}

/**
 * Decodes and validates a leaderboard submission from a byte array.
 *
 * @param data - UTF-8 encoded JSON bytes
 * @returns Validated LeaderboardSubmission object
 * @throws Error if data is invalid or missing required fields
 */
export function decodeSubmission(data: number[]): LeaderboardSubmission {
  const json = Utils.toUTF8(data)
  const parsed = JSON.parse(json)
  validateSubmission(parsed)
  return parsed
}

/**
 * Validates that an object conforms to the LeaderboardDefinition interface.
 *
 * This is a TypeScript assertion function that narrows the type.
 *
 * @param obj - Object to validate
 * @throws Error if validation fails with a descriptive message
 */
export function validateDefinition(obj: unknown): asserts obj is LeaderboardDefinition {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Definition must be an object')
  }
  const def = obj as Record<string, unknown>

  if (def.protocol !== PROTOCOL_NAME) {
    throw new Error(`Invalid protocol: expected ${PROTOCOL_NAME}`)
  }
  if (def.version !== PROTOCOL_VERSION) {
    throw new Error(`Invalid version: expected ${PROTOCOL_VERSION}`)
  }
  if (def.type !== 'leaderboard-definition') {
    throw new Error('Invalid type: expected leaderboard-definition')
  }
  if (typeof def.leaderboardId !== 'string' || def.leaderboardId.length === 0) {
    throw new Error('leaderboardId must be a non-empty string')
  }
  if (typeof def.publisherPubKey !== 'string' || def.publisherPubKey.length === 0) {
    throw new Error('publisherPubKey must be a non-empty string')
  }
  if (typeof def.rulesHash !== 'string' || def.rulesHash.length === 0) {
    throw new Error('rulesHash must be a non-empty string')
  }
  if (typeof def.createdAt !== 'number' || def.createdAt <= 0) {
    throw new Error('createdAt must be a positive number')
  }
  if (typeof def.signature !== 'string' || def.signature.length === 0) {
    throw new Error('signature must be a non-empty string')
  }
}

/**
 * Validates that an object conforms to the LeaderboardSubmission interface.
 *
 * This is a TypeScript assertion function that narrows the type.
 *
 * @param obj - Object to validate
 * @throws Error if validation fails with a descriptive message
 */
export function validateSubmission(obj: unknown): asserts obj is LeaderboardSubmission {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Submission must be an object')
  }
  const sub = obj as Record<string, unknown>

  if (sub.protocol !== PROTOCOL_NAME) {
    throw new Error(`Invalid protocol: expected ${PROTOCOL_NAME}`)
  }
  if (sub.version !== PROTOCOL_VERSION) {
    throw new Error(`Invalid version: expected ${PROTOCOL_VERSION}`)
  }
  if (sub.type !== 'leaderboard-submission') {
    throw new Error('Invalid type: expected leaderboard-submission')
  }
  if (typeof sub.leaderboardId !== 'string' || sub.leaderboardId.length === 0) {
    throw new Error('leaderboardId must be a non-empty string')
  }
  if (typeof sub.playerId !== 'string' || sub.playerId.length === 0) {
    throw new Error('playerId must be a non-empty string')
  }
  if (typeof sub.score !== 'number') {
    throw new Error('score must be a number')
  }
  if (typeof sub.nonce !== 'string' || sub.nonce.length === 0) {
    throw new Error('nonce must be a non-empty string')
  }
  if (typeof sub.expiresAt !== 'number' || sub.expiresAt <= 0) {
    throw new Error('expiresAt must be a positive number')
  }
  if (typeof sub.submittedAt !== 'number' || sub.submittedAt <= 0) {
    throw new Error('submittedAt must be a positive number')
  }
  if (typeof sub.publisherAttestation !== 'string' || sub.publisherAttestation.length === 0) {
    throw new Error('publisherAttestation must be a non-empty string')
  }
}
