/**
 * @fileoverview LeaderLib PushDrop Utilities
 *
 * Provides functions for parsing and creating PushDrop scripts
 * that contain LeaderLib data on the BSV blockchain.
 *
 * PushDrop is a protocol for storing data in transaction outputs
 * in a way that can be easily retrieved and verified.
 *
 * @module @leaderlib/core
 */

import { PushDrop, LockingScript, Utils } from '@bsv/sdk'
import {
  LeaderboardDefinition,
  LeaderboardSubmission,
  PROTOCOL_NAME,
  PROTOCOL_VERSION
} from './types.js'
import { encodeDefinition, encodeSubmission, decodeDefinition, decodeSubmission } from './serialization.js'

/**
 * Result of parsing a LeaderLib PushDrop script.
 */
export interface ParsedPushDrop {
  /** Type of record ('definition' or 'submission') */
  type: 'definition' | 'submission'

  /** Parsed and validated data */
  data: LeaderboardDefinition | LeaderboardSubmission
}

/**
 * Parses a locking script to extract LeaderLib data.
 *
 * @param script - BSV locking script to parse
 * @returns Parsed data with type discriminator, or null if not a valid LeaderLib script
 */
export function parseLeaderLibScript(script: LockingScript): ParsedPushDrop | null {
  try {
    const decoded = PushDrop.decode(script)
    if (!decoded || decoded.fields.length < 4) {
      return null
    }

    const protocol = Utils.toUTF8(decoded.fields[0])
    const version = parseInt(Utils.toUTF8(decoded.fields[1]), 10)
    const recordType = Utils.toUTF8(decoded.fields[2])
    const payload = decoded.fields[3]

    if (protocol !== PROTOCOL_NAME || version !== PROTOCOL_VERSION) {
      return null
    }

    if (recordType === 'definition') {
      return {
        type: 'definition',
        data: decodeDefinition(payload)
      }
    } else if (recordType === 'submission') {
      return {
        type: 'submission',
        data: decodeSubmission(payload)
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Checks if a locking script is a LeaderLib PushDrop script.
 *
 * Performs a lightweight check without fully parsing the payload.
 * Useful for filtering outputs in overlay topic managers.
 *
 * @param script - BSV locking script to check
 * @returns True if the script is a valid LeaderLib PushDrop
 */
export function isLeaderLibScript(script: LockingScript): boolean {
  try {
    const decoded = PushDrop.decode(script)
    if (!decoded || decoded.fields.length < 3) {
      return false
    }

    const protocol = Utils.toUTF8(decoded.fields[0])
    const version = parseInt(Utils.toUTF8(decoded.fields[1]), 10)

    return protocol === PROTOCOL_NAME && version === PROTOCOL_VERSION
  } catch {
    return false
  }
}

/**
 * Returns the protocol identifier fields for PushDrop encoding.
 *
 * @returns Array of byte arrays containing protocol name and version
 * @internal
 */
export function getProtocolFields(): number[][] {
  return [
    Utils.toArray(PROTOCOL_NAME, 'utf8'),
    Utils.toArray(String(PROTOCOL_VERSION), 'utf8')
  ]
}

/**
 * Creates PushDrop fields for a leaderboard definition.
 * Use with PushDrop.lock() to create an on-chain output.
 *
 * @param definition - The leaderboard definition to encode
 * @returns Array of byte arrays ready for PushDrop encoding
 */
export function getDefinitionFields(definition: LeaderboardDefinition): number[][] {
  return [
    ...getProtocolFields(),
    Utils.toArray('definition', 'utf8'),
    encodeDefinition(definition)
  ]
}

/**
 * Creates PushDrop fields for a score submission.
 * Use with PushDrop.lock() to create an on-chain output.
 *
 * @param submission - The score submission to encode
 * @returns Array of byte arrays ready for PushDrop encoding
 */
export function getSubmissionFields(submission: LeaderboardSubmission): number[][] {
  return [
    ...getProtocolFields(),
    Utils.toArray('submission', 'utf8'),
    encodeSubmission(submission)
  ]
}
