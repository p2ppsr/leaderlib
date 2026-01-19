/**
 * @fileoverview LeaderLib Attestation Server
 *
 * Standalone Express server for the LeaderLib attestation service.
 * Deployed to Google Cloud Run to handle score attestation requests.
 *
 * Environment Variables:
 * - PORT: Server port (default: 8080)
 * - LEADERLIB_PRIVATE_KEY_HEX: Publisher's private key (required)
 *
 * Endpoints:
 * - GET  /        - Health check (returns service info)
 * - GET  /health  - Health check (returns { status: 'ok' })
 * - POST /attest  - Create score attestation
 *
 * @module @leaderlib/server
 */

import express from 'express'
import { createExpressHandler } from './createExpressHandler.js'

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080
const PRIVATE_KEY_HEX = process.env.LEADERLIB_PRIVATE_KEY_HEX

// Validate required environment variables
if (!PRIVATE_KEY_HEX) {
  console.error('❌ LEADERLIB_PRIVATE_KEY_HEX environment variable is required')
  console.error('   Set this to your publisher private key in hex format')
  process.exit(1)
}

const app = express()

// CORS middleware
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Parse JSON bodies
app.use(express.json())

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Health check endpoints
app.get('/', (_req, res) => {
  res.json({ service: 'leaderlib-attestation-server', status: 'ok' })
})

app.post('/attest', createExpressHandler({
  privateKeyHex: PRIVATE_KEY_HEX
}))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// Start server
app.listen(PORT, () => {
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  🚀 LeaderLib Attestation Server')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Port: ${PORT}`)
  console.log(`  Endpoints:`)
  console.log(`    GET  /        - Service info`)
  console.log(`    GET  /health  - Health check`)
  console.log(`    POST /attest  - Create attestation`)
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
})
