import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import { listMedia, publishMedia } from '../../api/cloud'

export default function ContentPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [media, setMedia] = useState([])
  const [publishOpen, setPublishOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', description: '', pricePerMinute: 0.1 })
  const [message, setMessage] = useState('')

  const loadMedia = useCallback(async () => {
    setLoading(true)
    const { data, error: apiError } = await listMedia()
    if (apiError) {
      setError(apiError)
    } else {
      setMedia(data?.media || [])
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadMedia()
  }, [loadMedia])

  const handlePublish = async () => {
    setMessage('')
    const { data, error: apiError } = await publishMedia(draft)
    if (apiError) {
      setMessage(apiError)
      return
    }
    setPublishOpen(false)
    setDraft({ name: '', description: '', pricePerMinute: 0.1 })
    setMessage(`Published ${data?.media?.name}`)
    await loadMedia()
  }

  return (
    <PageScaffold
      title="Content"
      category="Cloud"
      description="VR content catalog and publish workflow (SVC-008)."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {!loading && !error && (
        <Stack spacing={2}>
          <Button variant="contained" onClick={() => setPublishOpen(true)} data-testid="publish-content">
            Publish Content
          </Button>
          <Grid container spacing={2}>
            {media.map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item.mediaId}>
                <Card variant="outlined">
                  <CardMedia component="img" height="120" image={item.cover} alt={item.name} />
                  <CardContent>
                    <Typography variant="subtitle1">{item.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.description}</Typography>
                    <Typography variant="caption">${item.pricePerMinute}/min · v{item.version}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>
      )}

      <Dialog open={publishOpen} onClose={() => setPublishOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Publish VR Content</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Title" fullWidth value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <TextField label="Description" fullWidth multiline rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <TextField label="Price per minute" type="number" fullWidth value={draft.pricePerMinute} onChange={(e) => setDraft({ ...draft, pricePerMinute: parseFloat(e.target.value) || 0 })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePublish}>Publish</Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
