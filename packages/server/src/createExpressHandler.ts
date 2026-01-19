/**
 * @fileoverview Express Handler Factory
 * @module @leaderlib/server
 */

import type { Request, Response, RequestHandler } from 'express'
import { AttestationSigner, AttestationSignerOptions } from './AttestationSigner.js'

/**
 * Creates an Express request handler for the `/attest` endpoint.
 * Expects JSON body with: leaderboardId, playerId, score, nonce.
 * Returns: { attestation, expiresAt } or { error }.
 *
 * @param options - AttestationSigner configuration
 * @returns Express request handler
 */
export function createExpressHandler(options: AttestationSignerOptions): RequestHandler {
  const signer = new AttestationSigner(options)

  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { leaderboardId, playerId, score, nonce } = req.body as {
        leaderboardId?: string
        playerId?: string
        score?: number
        nonce?: string
      }

      const response = await signer.attest({
        leaderboardId: leaderboardId ?? '',
        playerId: playerId ?? '',
        score: score ?? 0,
        nonce: nonce ?? ''
      })

      res.json(response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(400).json({ error: message })
    }
  }
}
