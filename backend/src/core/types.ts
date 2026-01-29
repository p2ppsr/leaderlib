export const PROTOCOL_NAME = 'leaderlib'
export const PROTOCOL_VERSION = 1
export const TOPIC_NAME = 'tm_leaderlib'
export const LOOKUP_SERVICE_NAME = 'ls_leaderlib'

export type LeaderboardRecordType = 'leaderboard-definition' | 'leaderboard-submission'

export interface LeaderboardDefinition {
  protocol: typeof PROTOCOL_NAME
  version: typeof PROTOCOL_VERSION
  type: 'leaderboard-definition'
  leaderboardId: string
  publisherPubKey: string
  rules: LeaderboardRules
  rulesHash: string
  createdAt: number
  signature: string
}

export interface LeaderboardSubmission {
  protocol: typeof PROTOCOL_NAME
  version: typeof PROTOCOL_VERSION
  type: 'leaderboard-submission'
  leaderboardId: string
  playerId: string
  score: number
  nonce: string
  expiresAt: number
  submittedAt: number
  publisherAttestation: string
}

export interface LeaderboardRules {
  name?: string
  description?: string
  maxScore?: number
  minScore?: number
  sortOrder?: 'asc' | 'desc'
  maxEntriesPerPlayer?: number
  metadata?: Record<string, unknown>
}

export interface LeaderboardEntry {
  playerId: string
  score: number
  submittedAt: number
  txid: string
  outputIndex: number
  rank?: number
}

export interface LeaderboardInfo {
  leaderboardId: string
  publisherPubKey: string
  rulesHash: string
  createdAt: number
  txid: string
  outputIndex: number
}
