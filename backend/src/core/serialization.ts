import { Utils, Hash } from '@bsv/sdk'
import {
  LeaderboardDefinition,
  LeaderboardSubmission,
  LeaderboardRules,
  PROTOCOL_NAME,
  PROTOCOL_VERSION
} from './types.js'

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

export function hashRules(rules: LeaderboardRules): string {
  const canonical = JSON.stringify(rules, Object.keys(rules).sort())
  const bytes = Utils.toArray(canonical, 'utf8')
  const hash = Hash.sha256(bytes)
  return Utils.toHex(hash)
}

export function encodeDefinition(definition: LeaderboardDefinition): number[] {
  const json = JSON.stringify(definition)
  return Utils.toArray(json, 'utf8')
}

export function decodeDefinition(data: number[]): LeaderboardDefinition {
  const json = Utils.toUTF8(data)
  const parsed = JSON.parse(json)
  validateDefinition(parsed)
  return parsed
}

export function encodeSubmission(submission: LeaderboardSubmission): number[] {
  const json = JSON.stringify(submission)
  return Utils.toArray(json, 'utf8')
}

export function decodeSubmission(data: number[]): LeaderboardSubmission {
  const json = Utils.toUTF8(data)
  const parsed = JSON.parse(json)
  validateSubmission(parsed)
  return parsed
}

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
