import {
  LookupService,
  LookupQuestion,
  LookupFormula,
  AdmissionMode,
  SpendNotificationMode,
  OutputAdmittedByTopic,
  OutputSpent
} from '@bsv/overlay'
import {
  parseLeaderLibScript,
  LeaderboardDefinition,
  LeaderboardSubmission,
  TOPIC_NAME,
  LOOKUP_SERVICE_NAME
} from '../core/index.js'
import { Db } from 'mongodb'
import {
  LeaderLibStorage,
  LeaderboardDefinitionRecord,
  LeaderboardSubmissionRecord
} from './LeaderLibStorage.js'
import docs from './LeaderLibLookupDocs.md.js'

class LeaderLibLookupService implements LookupService {
  readonly admissionMode: AdmissionMode = 'locking-script'
  readonly spendNotificationMode: SpendNotificationMode = 'none'

  constructor(public storage: LeaderLibStorage) { }

  async outputAdmittedByTopic(payload: OutputAdmittedByTopic): Promise<void> {
    if (payload.mode !== 'locking-script') throw new Error('Invalid payload mode')
    const { txid, outputIndex, topic, lockingScript } = payload
    if (topic !== TOPIC_NAME) return

    try {
      const parsed = parseLeaderLibScript(lockingScript)
      if (!parsed) return

      if (parsed.type === 'definition') {
        const definition = parsed.data as LeaderboardDefinition
        await this.storage.storeDefinition({
          leaderboardId: definition.leaderboardId,
          publisherPubKey: definition.publisherPubKey,
          rules: definition.rules,
          rulesHash: definition.rulesHash,
          createdAt: definition.createdAt,
          txid,
          outputIndex
        })
      } else if (parsed.type === 'submission') {
        const submission = parsed.data as LeaderboardSubmission
        await this.storage.storeSubmission({
          leaderboardId: submission.leaderboardId,
          playerId: submission.playerId,
          score: submission.score,
          nonce: submission.nonce,
          expiresAt: submission.expiresAt,
          submittedAt: submission.submittedAt,
          publisherAttestation: submission.publisherAttestation,
          txid,
          outputIndex
        })
      }
    } catch (error) {
      console.error('Error indexing LeaderLib record:', error)
    }
  }

  async outputSpent(payload: OutputSpent): Promise<void> {
    if (payload.mode !== 'none') throw new Error('Invalid payload mode')
    const { topic, txid, outputIndex } = payload
    if (topic !== TOPIC_NAME) return
    await this.storage.deleteRecord(txid, outputIndex)
  }

  async outputEvicted(txid: string, outputIndex: number): Promise<void> {
    await this.storage.deleteRecord(txid, outputIndex)
  }

  async lookup(question: LookupQuestion): Promise<LookupFormula> {
    if (question.query === undefined || question.query === null) {
      throw new Error('A valid query must be provided!')
    }
    if (question.service !== LOOKUP_SERVICE_NAME) {
      throw new Error(`Lookup service not supported: ${question.service}`)
    }

    const query = question.query as Record<string, unknown>

    if (query.findAll) {
      return await this.storage.findAll()
    }

    if (query.getTopN) {
      const opts = query.getTopN as { leaderboardId: string; n?: number }
      return await this.storage.findTopN({
        leaderboardId: opts.leaderboardId,
        limit: opts.n
      })
    }

    if (query.getLeaderboard) {
      const opts = query.getLeaderboard as { leaderboardId: string; limit?: number; cursor?: string }
      const offset = opts.cursor ? parseInt(opts.cursor, 10) : 0
      return await this.storage.getLeaderboard({
        leaderboardId: opts.leaderboardId,
        limit: opts.limit,
        offset
      })
    }

    if (query.getPlayerRank) {
      const opts = query.getPlayerRank as { leaderboardId: string; playerId: string }
      const { record } = await this.storage.getPlayerRank({
        leaderboardId: opts.leaderboardId,
        playerId: opts.playerId
      })
      if (!record) return []
      return [{ txid: record.txid, outputIndex: record.outputIndex }]
    }

    if (query.listLeaderboardsByPublisher) {
      const opts = query.listLeaderboardsByPublisher as { publisherPubKey: string }
      return await this.storage.listLeaderboardsByPublisher(opts.publisherPubKey)
    }

    if (query.getDefinition) {
      const opts = query.getDefinition as { leaderboardId: string }
      const definition = await this.storage.getDefinition(opts.leaderboardId)
      if (!definition) return []
      return [{ txid: definition.txid, outputIndex: definition.outputIndex }]
    }

    throw new Error(`Unsupported query: ${JSON.stringify(question)}`)
  }

  async getDocumentation(): Promise<string> {
    return docs
  }

  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'LeaderLib Lookup Service',
      shortDescription: 'Query leaderboards, rankings, and scores',
      version: '0.1.0'
    }
  }
}

export default (db: Db): LeaderLibLookupService => {
  return new LeaderLibLookupService(new LeaderLibStorage(db))
}
