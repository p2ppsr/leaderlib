import { AdmittanceInstructions, TopicManager, LookupService } from '@bsv/overlay'
import { Transaction, LookupResolver, ProtoWallet } from '@bsv/sdk'
import {
  parseLeaderLibScript,
  verifyDefinitionSignature,
  verifyAttestation,
  LeaderboardDefinition,
  LeaderboardSubmission,
  LOOKUP_SERVICE_NAME
} from '../core/index.js'
import docs from './LeaderLibTopicDocs.md.js'

export interface LeaderLibTopicManagerOptions {
  allowOpenLeaderboards?: boolean
}

const defaultOptions: Required<LeaderLibTopicManagerOptions> = {
  allowOpenLeaderboards: false
}

// Create a verifier wallet for signature verification (can use 'anyone' as we only verify)
const verifierWallet = new ProtoWallet('anyone')

export default class LeaderLibTopicManager implements TopicManager {
  private lookupResolver: LookupResolver
  private lookupService?: LookupService

  constructor(private readonly options: LeaderLibTopicManagerOptions = {}) {
    this.lookupResolver = new LookupResolver({
      networkPreset: 'local'
    })
  }

  setLookupService(lookupService: LookupService): void {
    this.lookupService = lookupService
  }

  private async getLeaderboardDefinition(leaderboardId: string): Promise<LeaderboardDefinition | null> {
    try {
      // Use the lookup service directly if available (same process)
      if (this.lookupService) {
        const result = await this.lookupService.lookup({
          service: LOOKUP_SERVICE_NAME,
          query: { getDefinition: { leaderboardId } }
        })
        if (result && Array.isArray(result) && result.length > 0) {
          // Result contains output references, we need the actual definition data
          // For now, return a minimal definition with just the pubkey
          const resultAny = result as any
          if (resultAny[0]?.publisherPubKey) {
            return resultAny[0] as LeaderboardDefinition
          }
        }
        return null
      }

      // Fall back to network lookup
      const result = await this.lookupResolver.query({
        service: LOOKUP_SERVICE_NAME,
        query: { getDefinition: { leaderboardId } }
      })

      const resultAny = result as any
      if (resultAny?.outputs && resultAny.outputs.length > 0) {
        // Parse the first output to get the definition
        const output = resultAny.outputs[0]
        if (output.beef) {
          const tx = Transaction.fromBEEF(output.beef)
          const parsed = parseLeaderLibScript(tx.outputs[output.outputIndex].lockingScript)
          if (parsed?.type === 'definition') {
            return parsed.data as LeaderboardDefinition
          }
        }
      }
      return null
    } catch (error) {
      console.warn(`Failed to lookup leaderboard ${leaderboardId}:`, error)
      return null
    }
  }

  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []
    const seenNonces = new Set<string>()
    const mergedOptions = { ...defaultOptions, ...this.options }

    try {
      const parsedTransaction = Transaction.fromBEEF(beef)

      for (const [i, output] of parsedTransaction.outputs.entries()) {
        try {
          const parsed = parseLeaderLibScript(output.lockingScript)
          if (!parsed) continue

          if (parsed.type === 'definition') {
            const definition = parsed.data as LeaderboardDefinition

            // Verify signature
            const sigValid = await verifyDefinitionSignature(
              verifierWallet,
              definition.signature,
              definition.leaderboardId,
              definition.publisherPubKey,
              definition.rulesHash,
              definition.createdAt
            )
            if (!sigValid) {
              console.warn(`Invalid definition signature for ${definition.leaderboardId}`)
              continue
            }

            // Check if leaderboard already exists
            const existing = await this.getLeaderboardDefinition(definition.leaderboardId)
            if (existing) {
              console.warn(`Duplicate leaderboardId: ${definition.leaderboardId}`)
              continue
            }

            outputsToAdmit.push(i)

          } else if (parsed.type === 'submission') {
            const submission = parsed.data as LeaderboardSubmission

            // Check if leaderboard exists
            const definition = await this.getLeaderboardDefinition(submission.leaderboardId)

            if (!definition && !mergedOptions.allowOpenLeaderboards) {
              console.warn(`Unknown leaderboardId: ${submission.leaderboardId}`)
              continue
            }

            // Check expiration
            if (submission.expiresAt < Date.now()) {
              console.warn(`Expired submission for ${submission.leaderboardId}`)
              continue
            }

            // Check nonce not reused within this batch
            const nonceKey = `${submission.leaderboardId}:${submission.nonce}`
            if (seenNonces.has(nonceKey)) {
              console.warn(`Duplicate nonce in batch: ${nonceKey}`)
              continue
            }

            // Verify attestation if we have the definition
            if (definition) {
              const attestationValid = await verifyAttestation(
                verifierWallet,
                submission.publisherAttestation,
                definition.publisherPubKey,
                submission.leaderboardId,
                submission.playerId,
                submission.score,
                submission.nonce,
                submission.expiresAt
              )
              if (!attestationValid) {
                console.warn(`Invalid attestation for ${submission.leaderboardId}`)
                continue
              }
            }

            seenNonces.add(nonceKey)
            outputsToAdmit.push(i)
          }
        } catch (error) {
          console.error('Error processing output:', error)
          continue
        }
      }

      if (outputsToAdmit.length === 0) {
        console.warn('No outputs admitted!')
      }
    } catch (error) {
      throw new Error(`TopicManager error: ${error}`)
    }

    return {
      outputsToAdmit,
      coinsToRetain: previousCoins
    }
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
      name: 'LeaderLib Topic Manager',
      shortDescription: 'Tamper-resistant leaderboards with publisher attestation',
      version: '0.1.0'
    }
  }
}
