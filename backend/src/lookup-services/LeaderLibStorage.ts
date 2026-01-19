import { Collection, Db } from 'mongodb'
import { LookupFormula } from '@bsv/overlay'
import { LeaderboardRules } from '../core/types.js'

export interface LeaderboardDefinitionRecord {
  leaderboardId: string
  publisherPubKey: string
  rules: LeaderboardRules
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
  expiresAt: number
  submittedAt: number
  publisherAttestation: string
  txid: string
  outputIndex: number
}

export interface FindTopOptions {
  leaderboardId: string
  limit?: number
}

export interface FindByPlayerOptions {
  leaderboardId: string
  playerId: string
}

export interface GetLeaderboardOptions {
  leaderboardId: string
  limit?: number
  offset?: number
}

export class LeaderLibStorage {
  private readonly definitions: Collection<LeaderboardDefinitionRecord>
  private readonly submissions: Collection<LeaderboardSubmissionRecord>

  constructor(private readonly db: Db) {
    this.definitions = db.collection<LeaderboardDefinitionRecord>('LeaderLibDefinitions')
    this.submissions = db.collection<LeaderboardSubmissionRecord>('LeaderLibSubmissions')
    void this.ensureIndexes()
  }

  private async ensureIndexes(): Promise<void> {
    await this.definitions.createIndex({ leaderboardId: 1 }, { unique: true })
    await this.definitions.createIndex({ publisherPubKey: 1 })
    await this.submissions.createIndex({ leaderboardId: 1, nonce: 1 }, { unique: true })
    await this.submissions.createIndex({ leaderboardId: 1, score: -1 })
    await this.submissions.createIndex({ leaderboardId: 1, playerId: 1 })
  }

  async storeDefinition(record: LeaderboardDefinitionRecord): Promise<void> {
    await this.definitions.updateOne(
      { leaderboardId: record.leaderboardId },
      { $setOnInsert: record },
      { upsert: true }
    )
  }

  async getDefinition(leaderboardId: string): Promise<LeaderboardDefinitionRecord | null> {
    return await this.definitions.findOne({ leaderboardId })
  }

  async storeSubmission(record: LeaderboardSubmissionRecord): Promise<void> {
    await this.submissions.updateOne(
      { leaderboardId: record.leaderboardId, nonce: record.nonce },
      { $setOnInsert: record },
      { upsert: true }
    )
  }

  async isNonceUsed(leaderboardId: string, nonce: string): Promise<boolean> {
    const record = await this.submissions.findOne({ leaderboardId, nonce })
    return !!record
  }

  async deleteRecord(txid: string, outputIndex: number): Promise<void> {
    await this.definitions.deleteOne({ txid, outputIndex })
    await this.submissions.deleteOne({ txid, outputIndex })
  }

  /**
   * Gets the sort direction for a leaderboard based on its rules.
   * Returns 1 for ascending (lowest first), -1 for descending (highest first).
   */
  private async getSortDirection(leaderboardId: string): Promise<1 | -1> {
    const definition = await this.definitions.findOne({ leaderboardId })
    return definition?.rules?.sortOrder === 'asc' ? 1 : -1
  }

  /**
   * Gets the maxEntriesPerPlayer setting for a leaderboard.
   * Returns undefined if not set (no limit).
   */
  private async getMaxEntriesPerPlayer(leaderboardId: string): Promise<number | undefined> {
    const definition = await this.definitions.findOne({ leaderboardId })
    return definition?.rules?.maxEntriesPerPlayer
  }

  async findTopN({ leaderboardId, limit = 10 }: FindTopOptions): Promise<LookupFormula> {
    const sortDir = await this.getSortDirection(leaderboardId)
    const maxEntries = await this.getMaxEntriesPerPlayer(leaderboardId)

    if (maxEntries === 1) {
      // Deduplicate: get best score per player using aggregation
      const pipeline = [
        { $match: { leaderboardId } },
        { $sort: { score: sortDir, submittedAt: 1 } },
        {
          $group: {
            _id: '$playerId',
            score: { $first: '$score' },
            submittedAt: { $first: '$submittedAt' },
            txid: { $first: '$txid' },
            outputIndex: { $first: '$outputIndex' }
          }
        },
        { $sort: { score: sortDir, submittedAt: 1 } },
        { $limit: limit }
      ]
      const records = await this.submissions.aggregate(pipeline).toArray()
      return records.map(r => ({ txid: r.txid as string, outputIndex: r.outputIndex as number }))
    }

    const records = await this.submissions
      .find({ leaderboardId })
      .sort({ score: sortDir, submittedAt: 1 })
      .limit(limit)
      .toArray()

    return records.map(r => ({ txid: r.txid, outputIndex: r.outputIndex }))
  }

  async getLeaderboard({ leaderboardId, limit = 50, offset = 0 }: GetLeaderboardOptions): Promise<LookupFormula> {
    const sortDir = await this.getSortDirection(leaderboardId)
    const maxEntries = await this.getMaxEntriesPerPlayer(leaderboardId)

    if (maxEntries === 1) {
      // Deduplicate: get best score per player using aggregation
      const pipeline = [
        { $match: { leaderboardId } },
        { $sort: { score: sortDir, submittedAt: 1 } },
        {
          $group: {
            _id: '$playerId',
            score: { $first: '$score' },
            submittedAt: { $first: '$submittedAt' },
            txid: { $first: '$txid' },
            outputIndex: { $first: '$outputIndex' }
          }
        },
        { $sort: { score: sortDir, submittedAt: 1 } },
        { $skip: offset },
        { $limit: limit }
      ]
      const records = await this.submissions.aggregate(pipeline).toArray()
      return records.map(r => ({ txid: r.txid as string, outputIndex: r.outputIndex as number }))
    }

    const records = await this.submissions
      .find({ leaderboardId })
      .sort({ score: sortDir, submittedAt: 1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    return records.map(r => ({ txid: r.txid, outputIndex: r.outputIndex }))
  }

  async getPlayerRank({ leaderboardId, playerId }: FindByPlayerOptions): Promise<{
    rank: number
    record: LeaderboardSubmissionRecord | null
  }> {
    const sortDir = await this.getSortDirection(leaderboardId)
    const maxEntries = await this.getMaxEntriesPerPlayer(leaderboardId)

    // Get player's best score (based on sort direction)
    const playerRecord = await this.submissions.findOne(
      { leaderboardId, playerId },
      { sort: { score: sortDir } }
    )

    if (!playerRecord) {
      return { rank: -1, record: null }
    }

    if (maxEntries === 1) {
      // Count unique players with better scores
      const betterScoreOp = sortDir === -1 ? '$gt' : '$lt'
      const pipeline = [
        { $match: { leaderboardId, score: { [betterScoreOp]: playerRecord.score } } },
        { $group: { _id: '$playerId' } },
        { $count: 'count' }
      ]
      const result = await this.submissions.aggregate(pipeline).toArray()
      const betterCount = result[0]?.count ?? 0
      return { rank: betterCount + 1, record: playerRecord }
    }

    // Count submissions with better scores
    const betterScoreOp = sortDir === -1 ? '$gt' : '$lt'
    const betterScoreCount = await this.submissions.countDocuments({
      leaderboardId,
      score: { [betterScoreOp]: playerRecord.score }
    })

    return { rank: betterScoreCount + 1, record: playerRecord }
  }

  async listLeaderboardsByPublisher(publisherPubKey: string): Promise<LookupFormula> {
    const records = await this.definitions
      .find({ publisherPubKey })
      .sort({ createdAt: -1 })
      .toArray()

    return records.map(r => ({ txid: r.txid, outputIndex: r.outputIndex }))
  }

  async findAll(): Promise<LookupFormula> {
    const definitions = await this.definitions.find({}).toArray()
    const submissions = await this.submissions.find({}).toArray()

    return [
      ...definitions.map(r => ({ txid: r.txid, outputIndex: r.outputIndex })),
      ...submissions.map(r => ({ txid: r.txid, outputIndex: r.outputIndex }))
    ]
  }
}
