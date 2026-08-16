import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

function matchesMediaSearch(item, search) {
  const q = String(search || '').trim().toLowerCase()
  if (!q) return true
  const hay = [
    item.name,
    item.description,
    item.mediaId,
    item.simulationMode,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function DetailRow({ label, value }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <Typography variant="body2">
      <Box component="span" sx={{ color: 'text.secondary' }}>{label}: </Box>
      {value}
    </Typography>
  )
}

/**
 * Searchable media picker (mirrors PlayerSelectDialog).
 */
export default function MediaSelectDialog({
  open,
  onClose,
  onSelect,
  media = [],
  selectedMediaId = '',
  testIdPrefix = 'media-select',
}) {
  const [search, setSearch] = useState('')
  const [highlightedId, setHighlightedId] = useState(null)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setHighlightedId(selectedMediaId || media[0]?.mediaId || null)
  }, [open, selectedMediaId, media])

  const filtered = useMemo(() => {
    return media
      .filter((item) => matchesMediaSearch(item, search))
      .slice()
      .sort((a, b) =>
        String(a.name || a.mediaId).localeCompare(String(b.name || b.mediaId), undefined, {
          sensitivity: 'base',
        }),
      )
  }, [media, search])

  const highlighted = filtered.find((item) => item.mediaId === highlightedId)
    || media.find((item) => item.mediaId === highlightedId)
    || null

  const handleConfirm = () => {
    if (!highlighted) return
    onSelect(highlighted)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      data-testid={`${testIdPrefix}-dialog`}
    >
      <DialogTitle>Select media</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, tags, description…"
            inputProps={{ 'data-testid': `${testIdPrefix}-search` }}
            fullWidth
            autoFocus
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ minHeight: 280 }}>
            <Box sx={{ flex: 1, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'auto' }}>
              <List dense disablePadding>
                {filtered.length === 0 ? (
                  <ListItemText
                    sx={{ px: 2, py: 2 }}
                    primary="No media match"
                    secondary={media.length === 0 ? 'Publish titles under Media' : 'Try another search'}
                  />
                ) : (
                  filtered.map((item) => (
                    <ListItemButton
                      key={item.mediaId}
                      selected={item.mediaId === highlightedId}
                      onClick={() => setHighlightedId(item.mediaId)}
                      onDoubleClick={() => {
                        onSelect(item)
                        onClose()
                      }}
                      data-testid={`${testIdPrefix}-row-${item.mediaId}`}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <span>{item.name || item.mediaId}</span>
                            {item.testMedia ? <Chip size="small" color="warning" label="Test" /> : null}
                          </Stack>
                        }
                        secondary={item.description || item.mediaId}
                      />
                    </ListItemButton>
                  ))
                )}
              </List>
            </Box>
            <Box sx={{ flex: 1, border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography variant="overline" color="text.secondary">Details</Typography>
              {!highlighted ? (
                <Typography variant="body2" color="text.secondary">Select a title</Typography>
              ) : (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {(highlighted.image || highlighted.cover) ? (
                    <Box
                      component="img"
                      src={highlighted.image || highlighted.cover}
                      alt=""
                      sx={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 1 }}
                    />
                  ) : null}
                  <Typography variant="subtitle1">{highlighted.name}</Typography>
                  <DetailRow label="Description" value={highlighted.description} />
                  <DetailRow label="Version" value={highlighted.version != null ? `v${highlighted.version}` : null} />
                  <DetailRow
                    label="Tags"
                    value={Array.isArray(highlighted.tags) && highlighted.tags.length
                      ? highlighted.tags.join(', ')
                      : null}
                  />
                  {highlighted.testMedia ? (
                    <>
                      <DetailRow label="Simulator" value={highlighted.simulationMode || 'random'} />
                      <DetailRow label="Scene" value={highlighted.deterministicConfig} />
                    </>
                  ) : null}
                  <DetailRow label="Media ID" value={highlighted.mediaId} />
                </Stack>
              )}
            </Box>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!highlighted}
          data-testid={`${testIdPrefix}-confirm`}
        >
          Select
        </Button>
      </DialogActions>
    </Dialog>
  )
}
