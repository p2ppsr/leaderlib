/**
 * @fileoverview LeaderLib Core Package
 *
 * Core types, serialization, and cryptographic utilities for the LeaderLib protocol.
 * This package provides the foundational building blocks used by both client and server.
 *
 * @packageDocumentation
 * @module @leaderlib/core
 *
 * @example
 * ```typescript
 * import {
 *   LeaderboardDefinition,
 *   LeaderboardSubmission,
 *   signAttestation,
 *   verifyAttestation,
 *   parseLeaderLibScript
 * } from '@leaderlib/core'
 * ```
 */

export * from './types.js'
export * from './serialization.js'
export * from './signatures.js'
export * from './pushdrop.js'
