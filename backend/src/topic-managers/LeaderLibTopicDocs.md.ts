export default `
# LeaderLib Topic Manager

Manages tamper-resistant, publisher-authoritative leaderboards on BSV.

## Topic

\`tm_leaderlib\`

## Admittance Rules

### Leaderboard Definitions
- Publisher signature must be valid
- leaderboardId must be unique
- Schema must be valid

### Score Submissions  
- Referenced leaderboardId must exist
- Publisher attestation signature must be valid
- Submission must not be expired
- Nonce must not be reused (replay protection)
- Schema must be valid

## Security Model

All submissions require cryptographic attestation from the leaderboard publisher.
This prevents unauthorized score submissions while maintaining on-chain auditability.
`
