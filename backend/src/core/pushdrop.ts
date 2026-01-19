import { PushDrop, LockingScript, Utils } from '@bsv/sdk'
import {
  LeaderboardDefinition,
  LeaderboardSubmission,
  PROTOCOL_NAME,
  PROTOCOL_VERSION
} from './types.js'
import { encodeDefinition, encodeSubmission, decodeDefinition, decodeSubmission } from './serialization.js'

export interface ParsedPushDrop {
  type: 'definition' | 'submission'
  data: LeaderboardDefinition | LeaderboardSubmission
}

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

export function getProtocolFields(): number[][] {
  return [
    Utils.toArray(PROTOCOL_NAME, 'utf8'),
    Utils.toArray(String(PROTOCOL_VERSION), 'utf8')
  ]
}

export function getDefinitionFields(definition: LeaderboardDefinition): number[][] {
  return [
    ...getProtocolFields(),
    Utils.toArray('definition', 'utf8'),
    encodeDefinition(definition)
  ]
}

export function getSubmissionFields(submission: LeaderboardSubmission): number[][] {
  return [
    ...getProtocolFields(),
    Utils.toArray('submission', 'utf8'),
    encodeSubmission(submission)
  ]
}
