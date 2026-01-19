export interface LeaderboardDefinitionRecord {
  leaderboardId: string
  publisherPubKey: string
  rulesHash: string
  createdAt: number
  txid: string
  outputIndex: number
}

export interface LeaderboardSubmissionRecord {
  leaderboardId: string
  playerId: string
  score: number
  nonce: string
  submittedAt: number
  txid: string
  outputIndex: number
}
