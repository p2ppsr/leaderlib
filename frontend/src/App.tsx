import React, { useState } from 'react'
import { toast } from 'react-toastify'
import {
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Fab,
  LinearProgress,
  Typography,
  IconButton,
  TextField,
  Box,
  Container,
  Chip,
  Avatar,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Grid,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import { styled } from '@mui/system'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import LeaderboardIcon from '@mui/icons-material/EmojiEvents'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import KeyIcon from '@mui/icons-material/Key'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import useAsyncEffect from 'use-async-effect'
import {
  LookupResolver,
  WalletClient,
  WalletInterface,
  Transaction,
  P2PKH,
  PublicKey
} from '@bsv/sdk'
import { makeBackendWallet, getIdentityKeyFromPrivate } from './utils/makeBackendWallet'
import { LeaderLibAdmin } from '@leaderlib/client'
import {
  parseLeaderLibScript,
  LeaderboardSubmission,
  LeaderboardDefinition
} from '@leaderlib/core'

const walletClient = new WalletClient()

const NETWORK_PRESET: 'local' | 'mainnet' = 'mainnet'

const AppBarPlaceholder = styled('div')({
  height: '4em'
})

const NoItems = styled(Box)({
  margin: 'auto',
  textAlign: 'center',
  marginTop: '3em',
  padding: '2em'
})

const AddMoreFab = styled(Fab)({
  position: 'fixed',
  right: '1em',
  bottom: '1em',
  zIndex: 10
})

const LoadingBar = styled(LinearProgress)({
  margin: '1em'
})

interface LeaderboardEntry {
  rank: number
  playerId: string
  score: number
  txid: string
}

interface MyLeaderboard {
  leaderboardId: string
  definition: LeaderboardDefinition
  txid: string
  entries: LeaderboardEntry[]
}

const App: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [myLeaderboards, setMyLeaderboards] = useState<MyLeaderboard[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<MyLeaderboard | null>(null)
  const [myIdentityKey, setMyIdentityKey] = useState<string | null>(null)
  const [walletConnected, setWalletConnected] = useState(false)

  // Backend wallet state (for creating leaderboards with a specific private key)
  const [privateKeyHex, setPrivateKeyHex] = useState('')
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [backendWallet, setBackendWallet] = useState<WalletInterface | null>(null)
  const [backendIdentityKey, setBackendIdentityKey] = useState<string | null>(null)
  const [backendBalance, setBackendBalance] = useState<number | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)

  // Leaderboard creation form state
  const [newLeaderboardId, setNewLeaderboardId] = useState('')
  const [leaderboardName, setLeaderboardName] = useState('')
  const [leaderboardDescription, setLeaderboardDescription] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [maxScore, setMaxScore] = useState('')
  const [minScore, setMinScore] = useState('')
  const [maxEntriesPerPlayer, setMaxEntriesPerPlayer] = useState('1')

  // Initialize wallet and load leaderboards
  useAsyncEffect(async () => {
    try {
      const { publicKey } = await walletClient.getPublicKey({ identityKey: true })
      setMyIdentityKey(publicKey)
      setWalletConnected(true)
      await loadMyLeaderboards(publicKey)
    } catch (e) {
      console.log('Wallet not available')
      setWalletConnected(false)
    }
  }, [])

  const loadMyLeaderboards = async (identityKey: string) => {
    setLoading(true)
    try {
      const resolver = new LookupResolver({ networkPreset: NETWORK_PRESET })

      // Query for leaderboard definitions by this publisher
      const lookupResult = await resolver.query({
        service: 'ls_leaderlib',
        query: {
          listLeaderboardsByPublisher: {
            publisherPubKey: identityKey
          }
        }
      }) as { outputs?: Array<{ beef: number[], outputIndex: number }> }

      const leaderboards: MyLeaderboard[] = []

      if (lookupResult.outputs && Array.isArray(lookupResult.outputs)) {
        for (const result of lookupResult.outputs) {
          try {
            const tx = Transaction.fromBEEF(result.beef)
            const outputIndex = Number(result.outputIndex)
            const lockingScript = tx.outputs[outputIndex].lockingScript
            const parsed = parseLeaderLibScript(lockingScript)

            if (parsed && parsed.type === 'definition') {
              const definition = parsed.data as LeaderboardDefinition
              leaderboards.push({
                leaderboardId: definition.leaderboardId,
                definition,
                txid: tx.id('hex'),
                entries: []
              })
            }
          } catch (error) {
            console.error('Failed to parse definition:', error)
          }
        }
      }

      // Load entries for each leaderboard
      for (const lb of leaderboards) {
        try {
          const entriesResult = await resolver.query({
            service: 'ls_leaderlib',
            query: {
              getTopN: {
                leaderboardId: lb.leaderboardId,
                n: 10
              }
            }
          }) as { outputs?: Array<{ beef: number[], outputIndex: number }> }

          if (entriesResult.outputs && Array.isArray(entriesResult.outputs)) {
            for (let i = 0; i < entriesResult.outputs.length; i++) {
              const result = entriesResult.outputs[i]
              try {
                const tx = Transaction.fromBEEF(result.beef)
                const outputIndex = Number(result.outputIndex)
                const lockingScript = tx.outputs[outputIndex].lockingScript
                const parsed = parseLeaderLibScript(lockingScript)

                if (parsed && parsed.type === 'submission') {
                  const submission = parsed.data as LeaderboardSubmission
                  lb.entries.push({
                    rank: i + 1,
                    playerId: submission.playerId,
                    score: submission.score,
                    txid: tx.id('hex')
                  })
                }
              } catch {
                // Skip malformed entries
              }
            }
          }
        } catch {
          // No entries yet
        }
      }

      setMyLeaderboards(leaderboards)

      if (leaderboards.length > 0) {
        toast.success(`Loaded ${leaderboards.length} leaderboard(s)`)
      }
    } catch (error) {
      console.error('Error loading leaderboards:', error)
      setMyLeaderboards([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    const keyToUse = backendIdentityKey || myIdentityKey
    if (keyToUse) {
      await loadMyLeaderboards(keyToUse)
    }
  }

  // Connect backend wallet from private key
  const handleConnectBackendWallet = async () => {
    if (!privateKeyHex || privateKeyHex.length !== 64) {
      toast.error('Please enter a valid 64-character hex private key')
      return
    }

    setWalletLoading(true)
    try {
      // First validate and get identity key without full wallet creation
      const identityKey = getIdentityKeyFromPrivate(privateKeyHex)
      setBackendIdentityKey(identityKey)

      // Create the full wallet
      const chain = 'main'
      const { wallet } = await makeBackendWallet(privateKeyHex, chain)
      setBackendWallet(wallet)

      // Get balance by listing outputs
      await refreshBackendBalance(wallet)

      toast.success('Backend wallet connected!')
      await loadMyLeaderboards(identityKey)
    } catch (error) {
      console.error('Error connecting backend wallet:', error)
      toast.error('Failed to connect backend wallet')
      setBackendWallet(null)
      setBackendIdentityKey(null)
      setBackendBalance(null)
    } finally {
      setWalletLoading(false)
    }
  }

  // Refresh backend wallet balance
  const refreshBackendBalance = async (wallet: WalletInterface) => {
    try {
      const result = await wallet.listOutputs({
        basket: 'default',
        include: 'locking scripts'
      })
      const totalSats = result.outputs.reduce((sum, out) => sum + out.satoshis, 0)
      setBackendBalance(totalSats)
    } catch (error) {
      console.error('Error fetching balance:', error)
      setBackendBalance(0)
    }
  }

  // Fund backend wallet from local WalletClient (following wui pattern)
  const handleFundBackendWallet = async (amount: number = 1000) => {
    if (!backendIdentityKey || !backendWallet || !walletConnected) {
      toast.error('Both local wallet and backend wallet must be connected')
      return
    }

    setWalletLoading(true)
    try {
      toast.info(`Funding backend wallet with ${amount} satoshis...`)

      // Get local wallet identity key
      const { publicKey: localIdentityKey } = await walletClient.getPublicKey({ identityKey: true })

      // Generate random derivation prefix/suffix for key derivation
      const randomBase64 = (len = 8) => {
        const arr = new Uint8Array(len)
        window.crypto.getRandomValues(arr)
        return btoa(String.fromCharCode(...arr))
      }
      const derivPrefix = randomBase64(8)
      const derivSuffix = randomBase64(8)

      // Derive a payment public key from local wallet for the backend wallet to receive
      const pubResp = await walletClient.getPublicKey({
        protocolID: [2, '3241645161d8'],
        keyID: `${derivPrefix} ${derivSuffix}`,
        counterparty: backendIdentityKey
      })
      const paymentPubKey = pubResp.publicKey

      // Build proper P2PKH locking script
      const lockingScript = new P2PKH().lock(PublicKey.fromString(paymentPubKey).toAddress()).toHex()

      // Create action from local wallet paying to the backend wallet
      const createResp = await walletClient.createAction({
        description: 'Fund LeaderLib backend wallet',
        outputs: [{
          lockingScript,
          satoshis: amount,
          outputDescription: 'Backend wallet funding',
          customInstructions: JSON.stringify({
            type: 'BRC29',
            derivationPrefix: derivPrefix,
            derivationSuffix: derivSuffix,
            payee: backendIdentityKey
          })
        }],
        options: {
          randomizeOutputs: false
        }
      })

      const atomicBEEF = createResp.tx as number[]
      if (!atomicBEEF || !atomicBEEF.length) {
        throw new Error('No transaction data returned from createAction')
      }

      // Internalize the transaction on the backend wallet
      await backendWallet.internalizeAction({
        tx: atomicBEEF,
        outputs: [{
          outputIndex: 0,
          protocol: 'wallet payment',
          paymentRemittance: {
            derivationPrefix: derivPrefix,
            derivationSuffix: derivSuffix,
            senderIdentityKey: localIdentityKey
          }
        }],
        description: 'Receiving funds from local wallet'
      })

      toast.success(`Funded! TXID: ${createResp.txid?.slice(0, 8)}...`)

      // Refresh balance after funding
      await refreshBackendBalance(backendWallet)
    } catch (error) {
      console.error('Error funding backend wallet:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to fund: ${message}`)
    } finally {
      setWalletLoading(false)
    }
  }

  // Disconnect backend wallet
  const handleDisconnectBackendWallet = () => {
    setBackendWallet(null)
    setBackendIdentityKey(null)
    setBackendBalance(null)
    setPrivateKeyHex('')
    if (myIdentityKey) {
      loadMyLeaderboards(myIdentityKey)
    }
  }

  const handleCreateLeaderboard = async () => {
    if (!newLeaderboardId || !leaderboardName) {
      toast.error('Please enter leaderboard ID and name')
      return
    }

    setLoading(true)
    try {
      toast.info(`Creating leaderboard: ${leaderboardName}...`)

      // Use backend wallet if connected, otherwise use local wallet
      const wallet = backendWallet || walletClient
      const admin = new LeaderLibAdmin({
        wallet,
        networkPreset: NETWORK_PRESET
      })

      const rules = {
        name: leaderboardName,
        description: leaderboardDescription || undefined,
        sortOrder,
        maxScore: maxScore ? parseInt(maxScore, 10) : undefined,
        minScore: minScore ? parseInt(minScore, 10) : undefined,
        maxEntriesPerPlayer: maxEntriesPerPlayer ? parseInt(maxEntriesPerPlayer, 10) : undefined
      }

      const { txid } = await admin.createLeaderboard(newLeaderboardId, rules)

      toast.success(`Leaderboard "${leaderboardName}" created! (txid: ${txid.slice(0, 8)}...)`)
      setCreateDialogOpen(false)

      // Reset form
      setNewLeaderboardId('')
      setLeaderboardName('')
      setLeaderboardDescription('')
      setSortOrder('desc')
      setMaxScore('')
      setMinScore('')
      setMaxEntriesPerPlayer('1')

      // Reload leaderboards
      if (myIdentityKey) {
        await loadMyLeaderboards(myIdentityKey)
      }
    } catch (error: unknown) {
      console.error('Error creating leaderboard:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to create leaderboard: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const openDetails = (lb: MyLeaderboard) => {
    setSelectedLeaderboard(lb)
    setDetailsDialogOpen(true)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied!`)
  }

  return (
    <>
      <AppBar position="fixed" color="primary">
        <Toolbar>
          <LeaderboardIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            LeaderLib Admin Dashboard
          </Typography>
          <Chip
            label={NETWORK_PRESET}
            size="small"
            color="success"
            sx={{ mr: 2 }}
          />
          <IconButton color="inherit" onClick={handleRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <AppBarPlaceholder />

      <Container maxWidth="md" sx={{ py: 3 }}>
        {!walletConnected && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Wallet not connected. Please connect a BSV wallet to manage your leaderboards.
          </Alert>
        )}

        {/* Backend Wallet Configuration */}
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <KeyIcon color={backendWallet ? 'success' : 'action'} />
              <Typography>
                {backendWallet ? 'Backend Wallet Connected' : 'Configure Backend Wallet'}
              </Typography>
              {backendWallet && (
                <Chip label="Active" size="small" color="success" sx={{ ml: 1 }} />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Enter a private key to create a backend wallet. This wallet will be used as the publisher
              identity for creating leaderboards. The same private key should be used by your attestation server.
            </Typography>

            {!backendWallet ? (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  fullWidth
                  type={showPrivateKey ? 'text' : 'password'}
                  label="Private Key (64-char hex)"
                  placeholder="Enter private key..."
                  value={privateKeyHex}
                  onChange={(e) => setPrivateKeyHex(e.target.value)}
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <IconButton
                        size="small"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                      >
                        {showPrivateKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    )
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleConnectBackendWallet}
                  disabled={!privateKeyHex || walletLoading}
                  startIcon={<AccountBalanceWalletIcon />}
                >
                  {walletLoading ? 'Connecting...' : 'Connect'}
                </Button>
              </Box>
            ) : (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Identity Key:</strong> {backendIdentityKey?.slice(0, 32)}...
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Balance:</strong> {backendBalance !== null ? `${backendBalance.toLocaleString()} sats` : 'Loading...'}
                  </Typography>
                </Alert>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleFundBackendWallet(1000)}
                    disabled={!walletConnected || walletLoading}
                  >
                    Fund (1000 sats)
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleDisconnectBackendWallet}
                  >
                    Disconnect
                  </Button>
                </Box>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Current Publisher Identity Display */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: backendWallet ? 'success.dark' : 'primary.dark' }}>
          <Typography variant="body2" color="white">
            <strong>Publisher Identity:</strong>{' '}
            {(backendIdentityKey || myIdentityKey)?.slice(0, 24)}...
          </Typography>
          <Typography variant="caption" color="grey.300">
            {backendWallet
              ? 'Using backend wallet. Leaderboards will be created with this identity.'
              : 'Using local wallet. Leaderboards created with this identity are shown below.'}
          </Typography>
        </Paper>

        {loading ? (
          <LoadingBar />
        ) : myLeaderboards.length > 0 ? (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              My Leaderboards ({myLeaderboards.length})
            </Typography>

            {myLeaderboards.map((lb) => (
              <Accordion key={lb.leaderboardId} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <LeaderboardIcon color="primary" />
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1">
                        {lb.definition.rules?.name || lb.leaderboardId}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        ID: {lb.leaderboardId} • {lb.entries.length} entries
                      </Typography>
                    </Box>
                    <Chip
                      label={lb.definition.rules?.sortOrder === 'asc' ? 'Low wins' : 'High wins'}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => copyToClipboard(lb.leaderboardId, 'Leaderboard ID')}
                    >
                      Copy ID
                    </Button>
                    <Button
                      size="small"
                      onClick={() => openDetails(lb)}
                      sx={{ ml: 1 }}
                    >
                      View Details
                    </Button>
                  </Box>

                  {lb.entries.length > 0 ? (
                    <List dense>
                      {lb.entries.map((entry, index) => (
                        <ListItem
                          key={entry.txid}
                          sx={{
                            bgcolor: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'transparent',
                            borderRadius: 1,
                            mb: 0.5
                          }}
                        >
                          <ListItemIcon>
                            <Avatar sx={{ bgcolor: 'primary.main', width: 28, height: 28, fontSize: 14 }}>
                              {entry.rank}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={entry.playerId}
                            secondary={`Score: ${entry.score.toLocaleString()}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                      No scores submitted yet
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        ) : walletConnected ? (
          <NoItems>
            <LeaderboardIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" color="textSecondary">
              No leaderboards yet
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Create your first leaderboard to get started!
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Leaderboard
            </Button>
          </NoItems>
        ) : null}
      </Container>

      {/* Leaderboard Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedLeaderboard?.definition.rules?.name || selectedLeaderboard?.leaderboardId}
        </DialogTitle>
        <DialogContent>
          {selectedLeaderboard && (
            <Box>
              <Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>
                Configuration
              </Typography>
              <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mt: 1 }}>
                <Typography variant="body2"><strong>ID:</strong> {selectedLeaderboard.leaderboardId}</Typography>
                <Typography variant="body2"><strong>Sort Order:</strong> {selectedLeaderboard.definition.rules?.sortOrder || 'desc'}</Typography>
                <Typography variant="body2"><strong>Max Entries/Player:</strong> {selectedLeaderboard.definition.rules?.maxEntriesPerPlayer || 'unlimited'}</Typography>
                {selectedLeaderboard.definition.rules?.description && (
                  <Typography variant="body2"><strong>Description:</strong> {selectedLeaderboard.definition.rules.description}</Typography>
                )}
              </Box>

              <Typography variant="subtitle2" color="primary" sx={{ mt: 2 }}>
                On-Chain Data
              </Typography>
              <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mt: 1 }}>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  <strong>TXID:</strong> {selectedLeaderboard.txid}
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  <strong>Publisher:</strong> {selectedLeaderboard.definition.publisherPubKey}
                </Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {new Date(selectedLeaderboard.definition.createdAt).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Leaderboard Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LeaderboardIcon color="primary" />
            Create Leaderboard
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Create a new leaderboard. The definition will be signed with your wallet identity
            and stored permanently on the BSV blockchain.
          </Typography>

          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
            Basic Information
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Leaderboard Name"
            placeholder="My Awesome Game Leaderboard"
            fullWidth
            variant="outlined"
            value={leaderboardName}
            onChange={(e) => setLeaderboardName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Leaderboard ID"
            placeholder="mygame:highscores"
            fullWidth
            variant="outlined"
            value={newLeaderboardId}
            onChange={(e) => setNewLeaderboardId(e.target.value)}
            helperText="Unique identifier (e.g., game-name:leaderboard-type)"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            placeholder="Track the highest scores in my game..."
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={leaderboardDescription}
            onChange={(e) => setLeaderboardDescription(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
            Scoring Rules
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth variant="outlined" margin="dense">
                <InputLabel>Sort Order</InputLabel>
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                  label="Sort Order"
                >
                  <MenuItem value="desc">Highest First</MenuItem>
                  <MenuItem value="asc">Lowest First</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                margin="dense"
                label="Max Entries Per Player"
                type="number"
                fullWidth
                variant="outlined"
                value={maxEntriesPerPlayer}
                onChange={(e) => setMaxEntriesPerPlayer(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                margin="dense"
                label="Minimum Score"
                type="number"
                fullWidth
                variant="outlined"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                margin="dense"
                label="Maximum Score"
                type="number"
                fullWidth
                variant="outlined"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </Grid>
          </Grid>

        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateLeaderboard}
            variant="contained"
            disabled={loading || !newLeaderboardId || !leaderboardName}
            startIcon={<LeaderboardIcon />}
          >
            Create Leaderboard
          </Button>
        </DialogActions>
      </Dialog>

      {walletConnected && (
        <AddMoreFab color="primary" onClick={() => setCreateDialogOpen(true)}>
          <AddIcon />
        </AddMoreFab>
      )}
    </>
  )
}

export default App
