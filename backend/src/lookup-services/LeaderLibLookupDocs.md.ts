export default `
# LeaderLib Lookup Service

Service: \`ls_leaderlib\`

## Available Queries

### getTopN
Get the top N scores for a leaderboard.
\`\`\`json
{ "getTopN": { "leaderboardId": "mygame:classic", "n": 10 } }
\`\`\`

### getLeaderboard
Get paginated leaderboard entries.
\`\`\`json
{ "getLeaderboard": { "leaderboardId": "mygame:classic", "limit": 50, "cursor": "0" } }
\`\`\`

### getPlayerRank
Get a specific player's rank and score.
\`\`\`json
{ "getPlayerRank": { "leaderboardId": "mygame:classic", "playerId": "player123" } }
\`\`\`

### listLeaderboardsByPublisher
List all leaderboards created by a publisher.
\`\`\`json
{ "listLeaderboardsByPublisher": { "publisherPubKey": "02abc..." } }
\`\`\`

### findAll
Get all indexed records.
\`\`\`json
{ "findAll": true }
\`\`\`
`
