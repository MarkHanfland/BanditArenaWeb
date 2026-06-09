import React, { useEffect, useState } from 'react'
import { Alert, CircularProgress, Stack, Typography } from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import { listMedia } from '../../api/cloud'

export default function ContentPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [media, setMedia] = useState([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error: apiError } = await listMedia()
      if (!mounted) return
      if (apiError) {
        setError(apiError)
      } else {
        setMedia(data?.media || [])
      }
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <PageScaffold
      title="Content"
      category="Cloud"
      description="Manage cloud-hosted media and experience content for Bandit Arena deployments."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            {media.length} media item(s) returned from /api/media.
          </Typography>
          {media.length === 0 && (
            <Typography variant="body2">No media entries yet — backend stub is ready for DynamoDB wiring.</Typography>
          )}
        </Stack>
      )}
    </PageScaffold>
  )
}
