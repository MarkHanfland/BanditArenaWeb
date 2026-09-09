import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import { MEDIA_BANNER_SX } from '../../components/shared/mediaBannerSx'
import {
  createMediaAssetUploadToken,
  createContentUploadToken,
  deleteMedia,
  getRoyaltyReport,
  listMedia,
  publishMedia,
  republishMedia,
  unpublishMedia,
  updateMedia,
} from '../../api/cloud'
import { usePlayerSession } from '../../session/PlayerSessionContext'

function usd(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0)
}

function isoDateUtc(d) {
  return d.toISOString().slice(0, 10)
}

const emptyDraft = {
  name: '',
  description: '',
  version: 1,
  tags: '',
  image: '',
  demoVideo: '',
  objectKey: '',
  pricePerMinute: 0.1,
  testMedia: false,
  simulationMode: 'deterministic',
  deterministicConfig: 'Default',
  published: true,
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

async function uploadAsset(mediaId, assetType, file) {
  const localPreviewUrl = URL.createObjectURL(file)
  const { data, error } = await createMediaAssetUploadToken(mediaId, {
    assetType,
    contentType: file.type || (assetType === 'demoVideo' ? 'video/mp4' : 'image/jpeg'),
    fileName: file.name,
  })
  if (!error && data?.uploadUrl && data.source === 's3') {
    const put = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || data.contentType || 'application/octet-stream' },
    })
    if (!put.ok) {
      URL.revokeObjectURL(localPreviewUrl)
      throw new Error(`Asset upload failed (${put.status})`)
    }
    // Persist object key only — API mints GetObject URLs for display (no multi-MB data URLs).
    return {
      previewUrl: localPreviewUrl,
      objectKey: data.objectKey,
      persistInlinePreview: false,
    }
  }
  // Alpha / no bucket: persist preview as data URL on the media record.
  const dataUrl = await readFileAsDataUrl(file)
  URL.revokeObjectURL(localPreviewUrl)
  return {
    previewUrl: dataUrl,
    objectKey: data?.objectKey || null,
    persistInlinePreview: true,
  }
}

/** SW-057: mint content upload-token and PUT the VR package (.pak) to private S3. */
async function uploadContentPackage(mediaId, file, version) {
  const { data, error } = await createContentUploadToken(mediaId, {
    version: version || 1,
    fileName: file.name,
  })
  if (error) throw new Error(error)
  if (!data?.objectKey) throw new Error('Upload token missing objectKey')

  if (data.uploadUrl && data.source === 's3') {
    const put = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': data.contentType || 'application/octet-stream' },
    })
    if (!put.ok) {
      throw new Error(`Content package upload failed (${put.status})`)
    }
  } else if (data.source !== 'placeholder') {
    throw new Error('Content package storage is not configured')
  }

  return {
    objectKey: data.objectKey,
    version: data.version || version || 1,
    source: data.source || 'unknown',
  }
}

export default function MediaPage() {
  const { selectedMediaId, setSelectedMediaId, sessionActive, loadMedia: refreshSessionMedia } =
    usePlayerSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [media, setMedia] = useState([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [message, setMessage] = useState('')
  const [messageSeverity, setMessageSeverity] = useState('success')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const packageInputRef = useRef(null)
  const [tab, setTab] = useState('catalog')
  const [royalties, setRoyalties] = useState(null)
  const [royaltyLoading, setRoyaltyLoading] = useState(false)
  const [royaltyError, setRoyaltyError] = useState('')
  const [royaltyFrom, setRoyaltyFrom] = useState('')
  const [royaltyTo, setRoyaltyTo] = useState('')

  const loadCatalog = useCallback(async () => {
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

  const loadRoyalties = useCallback(async (query = {}) => {
    setRoyaltyLoading(true)
    const period = query.from || query.to ? 'custom' : 'all'
    const { data, error: apiError } = await getRoyaltyReport({ ...query, period })
    if (apiError) {
      setRoyaltyError(apiError)
      setRoyalties(null)
    } else {
      setRoyalties(data)
      setRoyaltyError('')
    }
    setRoyaltyLoading(false)
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    if (tab === 'royalties') {
      loadRoyalties(
        royaltyFrom || royaltyTo ? { from: royaltyFrom, to: royaltyTo } : {},
      )
    }
    // Load once when opening the tab; Apply / All / 30d refetch explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft)
    setEditorOpen(true)
  }

  const openEdit = (item) => {
    setEditingId(item.mediaId)
    setDraft({
      name: item.name || '',
      description: item.description || '',
      version: item.version || 1,
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
      image: item.image || item.cover || '',
      demoVideo: item.demoVideo || '',
      objectKey: item.objectKey || '',
      pricePerMinute: item.pricePerMinute ?? 0.1,
      testMedia: Boolean(item.testMedia),
      simulationMode: item.simulationMode || 'deterministic',
      deterministicConfig: item.deterministicConfig || 'Default',
      published: item.published !== false,
    })
    setEditorOpen(true)
  }

  const buildPayload = () => ({
    name: draft.name.trim(),
    description: draft.description,
    version: Number(draft.version) || 1,
    tags: draft.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    image: draft.image || undefined,
    demoVideo: draft.demoVideo || undefined,
    objectKey: draft.objectKey || undefined,
    pricePerMinute: draft.pricePerMinute,
    testMedia: draft.testMedia,
    capabilities: draft.testMedia ? ['simulation'] : draft.capabilities || [],
    simulationMode: draft.testMedia ? draft.simulationMode : undefined,
    deterministicConfig:
      draft.testMedia && draft.simulationMode === 'deterministic'
        ? draft.deterministicConfig
        : undefined,
    published: draft.published,
  })

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setMessageSeverity('error')
      setMessage('Name is required')
      return
    }
    setSaving(true)
    setMessage('')
    const payload = buildPayload()
    const result = editingId
      ? await updateMedia(editingId, payload)
      : await publishMedia(payload)
    setSaving(false)
    if (result.error) {
      setMessageSeverity('error')
      setMessage(result.error)
      return
    }
    setEditorOpen(false)
    setMessageSeverity('success')
    setMessage(editingId ? `Updated ${result.data?.media?.name}` : `Created ${result.data?.media?.name}`)
    await loadCatalog()
    if (refreshSessionMedia) await refreshSessionMedia()
  }

  const handleUpload = async (assetType, file) => {
    if (!file) return
    setUploading(assetType)
    setMessage('')
    try {
      let mediaId = editingId
      if (!mediaId) {
        if (!draft.name.trim()) {
          throw new Error('Save a name first, or create the title before uploading assets')
        }
        const created = await publishMedia({
          ...buildPayload(),
          published: draft.published,
        })
        if (created.error) throw new Error(created.error)
        mediaId = created.data?.media?.mediaId
        setEditingId(mediaId)
      }
      const uploaded = await uploadAsset(mediaId, assetType, file)
      const patch =
        assetType === 'image'
          ? {
              ...(uploaded.objectKey ? { imageObjectKey: uploaded.objectKey } : {}),
              ...(uploaded.persistInlinePreview ? { image: uploaded.previewUrl } : {}),
            }
          : {
              ...(uploaded.objectKey ? { demoVideoObjectKey: uploaded.objectKey } : {}),
              ...(uploaded.persistInlinePreview ? { demoVideo: uploaded.previewUrl } : {}),
            }
      if (!uploaded.objectKey && !uploaded.persistInlinePreview) {
        throw new Error('Upload succeeded but no object key was returned')
      }
      const updated = await updateMedia(mediaId, patch)
      if (updated.error) throw new Error(updated.error)
      const displayUrl =
        (assetType === 'image'
          ? updated.data?.media?.image || updated.data?.media?.cover
          : updated.data?.media?.demoVideo) || uploaded.previewUrl
      setDraft((prev) => ({ ...prev, [assetType]: displayUrl }))
      setMessageSeverity('success')
      setMessage(`${assetType === 'image' ? 'Image' : 'Demo video'} uploaded`)
      await loadCatalog()
      if (refreshSessionMedia) await refreshSessionMedia()
    } catch (err) {
      setMessageSeverity('error')
      setMessage(err.message || 'Upload failed')
    } finally {
      setUploading('')
    }
  }

  const handlePackageUpload = async (file) => {
    if (!file) return
    setUploading('package')
    setMessage('')
    try {
      let mediaId = editingId
      if (!mediaId) {
        if (!draft.name.trim()) {
          throw new Error('Save a name first, or create the title before uploading a package')
        }
        const created = await publishMedia({
          ...buildPayload(),
          published: draft.published,
        })
        if (created.error) throw new Error(created.error)
        mediaId = created.data?.media?.mediaId
        setEditingId(mediaId)
      }
      const uploaded = await uploadContentPackage(mediaId, file, Number(draft.version) || 1)
      const updated = await updateMedia(mediaId, {
        objectKey: uploaded.objectKey,
        version: uploaded.version,
      })
      if (updated.error) throw new Error(updated.error)
      setDraft((prev) => ({
        ...prev,
        objectKey: uploaded.objectKey,
        version: uploaded.version,
      }))
      setMessageSeverity('success')
      setMessage(
        uploaded.source === 's3'
          ? `Content package uploaded (${uploaded.objectKey})`
          : `Package key registered (${uploaded.objectKey}); set BANDIT_CONTENT_BUCKET for S3 PutObject`,
      )
      await loadCatalog()
      if (refreshSessionMedia) await refreshSessionMedia()
    } catch (err) {
      setMessageSeverity('error')
      setMessage(err.message || 'Package upload failed')
    } finally {
      setUploading('')
    }
  }

  const handleUnpublish = async (item) => {
    const { error: apiError } = await unpublishMedia(item.mediaId)
    if (apiError) {
      setMessageSeverity('error')
      setMessage(apiError)
      return
    }
    setMessageSeverity('success')
    setMessage(`Unpublished ${item.name}`)
    await loadCatalog()
    if (refreshSessionMedia) await refreshSessionMedia()
  }

  const handlePublish = async (item) => {
    const { error: apiError } = await republishMedia(item.mediaId)
    if (apiError) {
      setMessageSeverity('error')
      setMessage(apiError)
      return
    }
    setMessageSeverity('success')
    setMessage(`Published ${item.name}`)
    await loadCatalog()
    if (refreshSessionMedia) await refreshSessionMedia()
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete “${item.name}”? This cannot be undone.`)) return
    const { error: apiError } = await deleteMedia(item.mediaId)
    if (apiError) {
      setMessageSeverity('error')
      setMessage(apiError)
      return
    }
    if (selectedMediaId === item.mediaId) {
      setSelectedMediaId('')
    }
    setMessageSeverity('success')
    setMessage(`Deleted ${item.name}`)
    await loadCatalog()
    if (refreshSessionMedia) await refreshSessionMedia()
  }

  return (
    <PageScaffold
      title="Media"
      category="Cloud"
      description="VR catalog and play-time royalty by title (SVC-008)."
    >
      {loading && tab === 'catalog' && <CircularProgress size={24} />}
      {error && tab === 'catalog' && <Alert severity="error">{error}</Alert>}
      {message && (
        <Alert severity={messageSeverity} sx={{ mb: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2 }}
      >
        <Tab label="Catalog" value="catalog" data-testid="media-tab-catalog" />
        <Tab label="Royalties" value="royalties" data-testid="media-tab-royalties" />
      </Tabs>
      {!loading && !error && tab === 'catalog' && (
        <Stack spacing={2}>
          <Button variant="contained" onClick={openCreate} data-testid="create-media">
            Create media
          </Button>
          <Grid container spacing={2}>
            {media.map((item) => {
              const image = item.image || item.cover
              const selected = item.mediaId === selectedMediaId
              const published = item.published !== false
              return (
                <Grid item xs={12} sm={6} md={4} key={item.mediaId}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderColor: selected ? 'primary.main' : undefined,
                      borderWidth: selected ? 2 : 1,
                      opacity: published ? 1 : 0.7,
                    }}
                  >
                    {image ? (
                      <CardMedia
                        component="img"
                        image={image}
                        alt={item.name}
                        sx={{ ...MEDIA_BANNER_SX, borderRadius: 0 }}
                      />
                    ) : (
                      <Box sx={{ ...MEDIA_BANNER_SX, borderRadius: 0 }} />
                    )}
                    <CardContent sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
                        <Typography variant="subtitle1">{item.name}</Typography>
                        {item.testMedia ? <Chip size="small" color="warning" label="Test" /> : null}
                        {!published ? <Chip size="small" label="Unpublished" /> : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {item.description}
                      </Typography>
                      <Typography variant="caption" display="block">
                        v{item.version}
                        {item.pricePerMinute != null ? ` · $${item.pricePerMinute}/min` : ''}
                        {item.testMedia
                          ? ` · sim: ${item.simulationMode}${item.deterministicConfig ? ` / ${item.deterministicConfig}` : ''}`
                          : ''}
                      </Typography>
                      {Array.isArray(item.tags) && item.tags.length > 0 ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                          {item.tags.map((tag) => (
                            <Chip key={tag} size="small" label={tag} variant="outlined" />
                          ))}
                        </Stack>
                      ) : null}
                      {item.demoVideo ? (
                        <Typography
                          variant="caption"
                          component="a"
                          href={item.demoVideo}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ display: 'block', mt: 1, color: 'primary.main' }}
                        >
                          Demo video
                        </Typography>
                      ) : null}
                    </CardContent>
                    <CardActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      <Button size="small" onClick={() => openEdit(item)} data-testid={`edit-media-${item.mediaId}`}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        disabled={sessionActive || selected || !published}
                        onClick={() => setSelectedMediaId(item.mediaId)}
                      >
                        {selected ? 'Selected' : 'Use for session'}
                      </Button>
                      {published ? (
                        <Button size="small" onClick={() => handleUnpublish(item)}>
                          Unpublish
                        </Button>
                      ) : (
                        <Button size="small" onClick={() => handlePublish(item)}>
                          Publish
                        </Button>
                      )}
                      <Button size="small" color="error" onClick={() => handleDelete(item)}>
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        </Stack>
      )}

      {tab === 'royalties' && (
        <Stack spacing={2} data-testid="media-royalties">
          <Typography variant="h6">Play-time royalty by title</Typography>
          <Typography variant="body2" color="text.secondary">
            Minutes × price per minute from session play-time. Commerce Revenue is a different ledger.
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
            <TextField
              label="From"
              type="date"
              size="small"
              value={royaltyFrom}
              onChange={(e) => setRoyaltyFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              data-testid="media-royalties-from"
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={royaltyTo}
              onChange={(e) => setRoyaltyTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              data-testid="media-royalties-to"
            />
            <Button
              variant="contained"
              size="small"
              disabled={royaltyLoading}
              onClick={() => loadRoyalties({ from: royaltyFrom, to: royaltyTo })}
              data-testid="media-royalties-apply"
            >
              Apply
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={royaltyLoading}
              onClick={() => {
                setRoyaltyFrom('')
                setRoyaltyTo('')
                loadRoyalties({})
              }}
              data-testid="media-royalties-all"
            >
              All
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={royaltyLoading}
              onClick={() => {
                const to = isoDateUtc(new Date())
                const from = isoDateUtc(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000))
                setRoyaltyFrom(from)
                setRoyaltyTo(to)
                loadRoyalties({ from, to })
              }}
              data-testid="media-royalties-30d"
            >
              Last 30 days
            </Button>
          </Stack>
          {royaltyLoading && <CircularProgress size={24} />}
          {royaltyError && <Alert severity="error">{royaltyError}</Alert>}
          {!royaltyLoading && royalties && (
            <>
              <Table size="small" data-testid="media-royalties-table">
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Media ID</TableCell>
                    <TableCell align="right">Minutes</TableCell>
                    <TableCell align="right">$/min</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(royalties.rows || []).map((row) => (
                    <TableRow key={row.mediaId}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.mediaId}</TableCell>
                      <TableCell align="right">{row.minutes}</TableCell>
                      <TableCell align="right">{usd(row.pricePerMinute)}</TableCell>
                      <TableCell align="right">{usd(row.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="subtitle1" data-testid="media-royalties-total">
                Total · {(royalties.rows || []).reduce((sum, r) => sum + (r.minutes || 0), 0)} min ·{' '}
                {usd((royalties.rows || []).reduce((sum, r) => sum + (r.revenue || 0), 0))}
                {royalties.period ? ` · ${royalties.period}` : ''}
              </Typography>
            </>
          )}
        </Stack>
      )}

      <Dialog open={editorOpen} onClose={() => !saving && setEditorOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit media' : 'Create media'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <TextField
              label="Version"
              type="number"
              fullWidth
              value={draft.version}
              onChange={(e) => setDraft({ ...draft, version: parseInt(e.target.value, 10) || 1 })}
            />
            <TextField
              label="Tags (comma-separated)"
              fullWidth
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            />
            <TextField
              label="Image URL"
              fullWidth
              value={draft.image?.startsWith('data:') ? '(uploaded image)' : draft.image}
              onChange={(e) => setDraft({ ...draft, image: e.target.value })}
              helperText="Paste a URL or upload a file below"
            />
            {draft.image?.startsWith('data:') || (draft.image && !draft.image.startsWith('data:')) ? (
              <Box
                component="img"
                src={draft.image}
                alt="Preview"
                sx={MEDIA_BANNER_SX}
              />
            ) : null}
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                disabled={Boolean(uploading)}
                onClick={() => imageInputRef.current?.click()}
                data-testid="upload-media-image"
              >
                {uploading === 'image' ? 'Uploading…' : 'Upload image'}
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                hidden
                data-testid="upload-media-image-input"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  handleUpload('image', file)
                }}
              />
            </Stack>
            <TextField
              label="Demo video URL"
              fullWidth
              value={draft.demoVideo?.startsWith('data:') ? '(uploaded video)' : draft.demoVideo}
              onChange={(e) => setDraft({ ...draft, demoVideo: e.target.value })}
              helperText="Paste a URL or upload a file below"
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                disabled={Boolean(uploading)}
                onClick={() => videoInputRef.current?.click()}
              >
                {uploading === 'demoVideo' ? 'Uploading…' : 'Upload demo video'}
              </Button>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  handleUpload('demoVideo', file)
                }}
              />
            </Stack>
            <TextField
              label="Content package object key"
              fullWidth
              value={draft.objectKey}
              onChange={(e) => setDraft({ ...draft, objectKey: e.target.value })}
              helperText="Private S3 key for the VR package (set automatically on upload)"
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                disabled={Boolean(uploading)}
                onClick={() => packageInputRef.current?.click()}
                data-testid="upload-content-package"
              >
                {uploading === 'package' ? 'Uploading…' : 'Upload content package'}
              </Button>
              <input
                ref={packageInputRef}
                type="file"
                accept=".pak,.zip,application/octet-stream"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  handlePackageUpload(file)
                }}
              />
            </Stack>
            <TextField
              label="Price per minute"
              type="number"
              fullWidth
              value={draft.pricePerMinute}
              onChange={(e) => setDraft({ ...draft, pricePerMinute: parseFloat(e.target.value) || 0 })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draft.published}
                  onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
                />
              }
              label="Published"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draft.testMedia}
                  onChange={(e) => setDraft({ ...draft, testMedia: e.target.checked })}
                />
              }
              label="Test media (drives Camera Simulator mode)"
            />
            {draft.testMedia ? (
              <>
                <TextField
                  select
                  label="Simulation mode"
                  fullWidth
                  value={draft.simulationMode}
                  onChange={(e) => setDraft({ ...draft, simulationMode: e.target.value })}
                >
                  <MenuItem value="deterministic">deterministic</MenuItem>
                  <MenuItem value="random">random</MenuItem>
                  <MenuItem value="playback">playback</MenuItem>
                </TextField>
                {draft.simulationMode === 'deterministic' ? (
                  <TextField
                    select
                    label="Deterministic scene"
                    fullWidth
                    value={draft.deterministicConfig}
                    onChange={(e) => setDraft({ ...draft, deterministicConfig: e.target.value })}
                  >
                    <MenuItem value="Default">Default (Deterministic)</MenuItem>
                    <MenuItem value="Cut Scene">Cut Scene</MenuItem>
                    <MenuItem value="Falling Test">Fall Test</MenuItem>
                  </TextField>
                ) : null}
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !draft.name.trim()}>
            {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
