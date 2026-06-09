import React, { useEffect, useState } from 'react'
import { Alert, CircularProgress, Stack, Typography } from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import { listUsers } from '../../api/cloud'

export default function UsersPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error: apiError } = await listUsers()
      if (!mounted) return
      if (apiError) {
        setError(apiError)
      } else {
        setUsers(data?.users || [])
      }
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <PageScaffold
      title="Users"
      category="Cloud"
      description="Administrator and player accounts managed in the cloud."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            {users.length} user(s) from /api/users.
          </Typography>
        </Stack>
      )}
    </PageScaffold>
  )
}
