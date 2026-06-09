import React, { useEffect, useState } from 'react'
import { Alert, CircularProgress, Stack, Typography } from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import { listProducts, listProductInstances } from '../../api/cloud'

export default function UsagePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({ products: 0, instances: 0 })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [productsRes, instancesRes] = await Promise.all([listProducts(), listProductInstances()])
      if (!mounted) return
      const apiError = productsRes.error || instancesRes.error
      if (apiError) {
        setError(apiError)
      } else {
        setSummary({
          products: productsRes.data?.products?.length || 0,
          instances: instancesRes.data?.instances?.length || 0,
        })
      }
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <PageScaffold
      title="Usage"
      category="Cloud"
      description="Aggregated fleet usage metrics across registered Bandit products."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <Stack spacing={1}>
          <Typography variant="body2">Products: {summary.products}</Typography>
          <Typography variant="body2">Instances: {summary.instances}</Typography>
        </Stack>
      )}
    </PageScaffold>
  )
}
