import React, { useEffect, useState } from 'react'
import { Alert, CircularProgress, Stack, Typography } from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import { listProductInstances } from '../../api/cloud'

export default function FleetPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [instances, setInstances] = useState([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error: apiError } = await listProductInstances()
      if (!mounted) return
      if (apiError) {
        setError(apiError)
      } else {
        setInstances(data?.instances || [])
      }
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <PageScaffold
      title="Fleet"
      category="Cloud"
      description="Multi-device fleet view for venues and operators."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            {instances.length} product instance(s) from /api/product-instances.
          </Typography>
        </Stack>
      )}
    </PageScaffold>
  )
}
