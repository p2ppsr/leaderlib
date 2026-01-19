# LeaderLib

Tamper-resistant, publisher-authoritative leaderboards on BSV.

Demo this in the wild at: [PeerJump.fun](https://peerjump.fun)

## Overview

LeaderLib combines:
- **Immutable on-chain records** (BSV blockchain)
- **Publisher-authoritative validation** (cryptographic attestations)
- **Overlay services** that define canonical state

This enables game and app developers to add leaderboards that are easy to integrate, tamper-resistant, auditable, and not locked into a single centralized provider.

## Packages

| Package | Description |
|---------|-------------|
| `@leaderlib/core` | Schemas, serialization, and signature utilities |
| `@leaderlib/client` | High-level SDK for score submission and queries |
| `@leaderlib/server` | Publisher attestation signer (serverless-friendly) |
| `@leaderlib/overlay` | Topic Manager and Lookup Service implementation |

## Quick Start

### Installation

```bash
npm install @leaderlib/client
```

### Basic Usage

```typescript
import { leaderboard } from '@leaderlib/client'

// Create a leaderboard client
const lb = leaderboard('mygame:classic', {
  signerUrl: 'https://api.mygame.com/leaderlib'
})

// Submit a score
await lb.submit({
  playerId: 'player123',
  score: 9500
})

// Get top 10 scores
const top = await lb.getTop(10)
console.log(top)
```

### Creating a Leaderboard (Publisher)

```typescript
import { LeaderLibAdmin, generateKeyPair } from '@leaderlib/client'

// Generate publisher keys (do this once, store securely)
const keys = generateKeyPair()
console.log('Public Key:', keys.publicKey)
console.log('Private Key (WIF):', keys.privateKey)

// Create admin instance
const admin = new LeaderLibAdmin(keys.privateKey)

// Create a new leaderboard
const { txid, definition } = await admin.createLeaderboard('mygame:classic', {
  maxScore: 100000,
  sortOrder: 'desc'
})
```

## Architecture

```
+------------------+
| Game Client      |
| (Web / Mobile)   |
+--------+---------+
         |
         | submit score
         v
+--------+---------+
| Publisher Signer |
| (Serverless)     |
+--------+---------+
         |
         | attestation signature
         v
+--------+---------+
| BSV Blockchain   |
| (PushDrop data)  |
+--------+---------+
         |
         | indexed by
         v
+--------+---------+
| LeaderLib Overlay|
| (Topic Manager + |
|  Lookup Service) |
+------------------+
```

## Setting Up the Attestation Server

### Express Server

```typescript
import express from 'express'
import { createExpressHandler } from '@leaderlib/server'

const app = express()
app.use(express.json())

app.post('/attest', createExpressHandler({
  privateKeyHex: process.env.LEADERLIB_PRIVATE_KEY_HEX!,
  validateScore: async ({ score }) => {
    // Add your custom validation logic here
    return score >= 0 && score <= 100000
  }
}))

app.listen(3000)
```

### Standalone Server

```bash
LEADERLIB_PRIVATE_KEY_HEX=your-hex-key npm run start -w @leaderlib/server
```

## Running the Overlay Service

```bash
# Set environment variables
export DB_PATH=./leaderlib.sqlite
export PORT=8080

# Start the overlay
npm run start -w @leaderlib/overlay
```

## Trust Models

LeaderLib supports graduated trust tiers:

### Tier 0 — Open Leaderboards
- No publisher attestation required
- Overlay accepts all valid schema submissions
- Suitable for casual/demo use only

### Tier 1 — Publisher-Attested (Default)
- Submissions must include publisher signature
- Overlay verifies against definition record
- Recommended for most games

### Tier 2 — Publisher-Hosted
- Server publishes submissions directly
- Full anti-cheat / normalization possible
- Same on-chain format

## API Reference

### Client API

```typescript
// Create client
const lb = leaderboard(id: string, options?: LeaderLibClientOptions)

// Submit score
await lb.submit({ playerId: string, score: number })

// Get top N scores
const entries = await lb.getTop(n: number)

// Get paginated leaderboard
const { entries, cursor, hasMore } = await lb.getLeaderboard({ limit?: number, cursor?: string })

// Get player rank
const { rank, entry } = await lb.getPlayerRank(playerId: string)
```

### Overlay Queries

```typescript
// Get top N
{ "getTopN": { "leaderboardId": "mygame:classic", "n": 10 } }

// Get paginated leaderboard
{ "getLeaderboard": { "leaderboardId": "mygame:classic", "limit": 50, "cursor": "0" } }

// Get player rank
{ "getPlayerRank": { "leaderboardId": "mygame:classic", "playerId": "player123" } }

// List leaderboards by publisher
{ "listLeaderboardsByPublisher": { "publisherPubKey": "02abc..." } }
```

## Security

- Private keys never embedded in clients
- Attestations are short-lived (default: 5 minutes)
- Replay protected via nonce + expiry
- Overlay enforces canonical acceptance
- All state is auditable on-chain

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Open BSV License. See [LICENSE.txt](./LICENSE.txt) for details.
