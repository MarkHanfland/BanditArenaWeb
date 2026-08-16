import React, { useState } from 'react'
import {
  Button,
  CircularProgress,
  Stack,
  TextField,
} from '@mui/material'
import { usePlayerSession } from '../../session/PlayerSessionContext'
import { playerDisplayName } from '../../session/playerSelectUtils'
import PlayerSelectDialog from './PlayerSelectDialog'
import MediaSelectDialog from './MediaSelectDialog'

/** Matches the TREAD direction arrow on the dashboard canvas. */
export const TREAD_GREEN = '#00d4aa'
const STATUS_BLUE = '#00e5ff'

const endSessionButtonSx = {
  color: STATUS_BLUE,
  borderColor: STATUS_BLUE,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  '&:hover': {
    borderColor: STATUS_BLUE,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  '&.Mui-disabled': {
    borderColor: 'rgba(0, 229, 255, 0.3)',
    color: 'rgba(0, 229, 255, 0.4)',
  },
}

const startSessionButtonSx = {
  color: TREAD_GREEN,
  borderColor: TREAD_GREEN,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  '&:hover': {
    borderColor: TREAD_GREEN,
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
  },
  '&.Mui-disabled': {
    borderColor: 'rgba(0, 212, 170, 0.3)',
    color: 'rgba(0, 212, 170, 0.4)',
  },
}

const lockedFieldSx = {
  '& .MuiOutlinedInput-root.Mui-disabled': {
    '& fieldset': { borderColor: 'rgba(224, 224, 224, 0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(224, 224, 224, 0.12)' },
  },
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: 'rgba(224, 224, 224, 0.38)',
    cursor: 'default',
  },
  '& .MuiInputLabel-root.Mui-disabled': {
    color: 'rgba(224, 224, 224, 0.38)',
  },
}

/**
 * @param {'all' | 'player' | 'action'} part
 *   all    — picker + media + Start/End (User tab)
 *   player — picker + media (status bar left)
 *   action — Start/End Session only (status bar right)
 */
export default function PlayerSessionControls({
  compact = false,
  deviceOnline = true,
  part = 'all',
}) {
  const {
    session,
    selected,
    setSelected,
    options,
    mediaOptions,
    selectedMediaId,
    setSelectedMediaId,
    selectedMediaIsTest,
    trackingReady,
    busy,
    sessionActive,
    handleStart,
    handleEnd,
  } = usePlayerSession()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)

  const selectTestId = compact ? 'header-player-select' : 'player-select'
  const mediaTestId = compact ? 'header-media-select' : 'media-select'
  const dialogTestId = compact ? 'header-player-select-dialog' : 'player-select-dialog'
  const mediaDialogTestId = compact ? 'header-media-select' : 'media-select'
  const showPlayer = part === 'all' || part === 'player'
  const showAction = part === 'all' || part === 'action'

  // Test media starts CameraSimulator on session start, so tracking is not required up front.
  const startBlockedByTracking = !trackingReady && !selectedMediaIsTest

  const playerValue = sessionActive
    ? (session?.displayName || session?.userId || '')
    : (selected ? playerDisplayName(selected) : '')
  const mediaValue = sessionActive
    ? (session?.mediaId || selectedMediaId || '')
    : (selectedMediaId || '')
  const mediaDisplayName = (() => {
    const id = mediaValue
    const match = mediaOptions.find((item) => item.mediaId === id)
    return match?.name || id || ''
  })()

  if (!deviceOnline) {
    return null
  }

  const endButton = (
    <Button
      variant="outlined"
      size="small"
      onClick={handleEnd}
      disabled={busy}
      data-testid={compact ? 'header-session-end' : 'session-end'}
      sx={endSessionButtonSx}
    >
      {busy ? 'Ending...' : 'End Session'}
    </Button>
  )

  const startButton = (
    <Button
      variant="outlined"
      size="small"
      onClick={handleStart}
      disabled={busy || !selected?.userId || !selectedMediaId || startBlockedByTracking}
      data-testid={compact ? 'header-session-start' : 'session-start'}
      sx={startSessionButtonSx}
    >
      {busy ? <CircularProgress size={14} color="inherit" /> : 'Start Session'}
    </Button>
  )

  if (part === 'action') {
    return sessionActive ? endButton : startButton
  }

  const compactFieldSx = {
    flexShrink: 0,
    bgcolor: compact ? 'background.default' : undefined,
    borderRadius: 1,
    ...(sessionActive ? lockedFieldSx : {}),
  }

  return (
    <>
      <Stack
        direction={compact ? 'row' : 'column'}
        spacing={1}
        alignItems={compact ? 'center' : 'stretch'}
        sx={{ minWidth: compact ? 'auto' : '100%', flexShrink: 0 }}
      >
        {showPlayer && (
          <TextField
            size="small"
            label={compact ? 'Player' : 'Enrolled player'}
            value={playerValue}
            placeholder={options.length ? 'Select player…' : 'No active players'}
            helperText={
              !compact && !sessionActive && options.length === 0
                ? 'Seed demo users or activate under Users'
                : undefined
            }
            onClick={() => {
              if (!sessionActive) {
                setPickerOpen(true)
              }
            }}
            disabled={sessionActive}
            InputProps={{
              readOnly: true,
            }}
            inputProps={{
              'data-testid': selectTestId,
              style: { cursor: sessionActive ? 'default' : 'pointer' },
            }}
            sx={{
              minWidth: compact ? 150 : undefined,
              width: compact ? 165 : undefined,
              ...compactFieldSx,
              '& .MuiInputBase-root': {
                cursor: sessionActive ? 'default' : 'pointer',
              },
            }}
          />
        )}
        {showPlayer && (
          <TextField
            size="small"
            label={compact ? 'Media' : 'Media title'}
            value={mediaDisplayName}
            placeholder={mediaOptions.length ? 'Select media…' : 'No media'}
            helperText={
              !compact && !sessionActive && mediaOptions.length === 0
                ? 'Create titles under Media, or seed demo media'
                : undefined
            }
            onClick={() => {
              if (!sessionActive) {
                setMediaPickerOpen(true)
              }
            }}
            disabled={sessionActive}
            InputProps={{
              readOnly: true,
            }}
            inputProps={{
              'data-testid': mediaTestId,
              style: { cursor: sessionActive ? 'default' : 'pointer' },
            }}
            sx={{
              minWidth: compact ? 270 : undefined,
              width: compact ? 300 : undefined,
              ...compactFieldSx,
              '& .MuiInputBase-root': {
                cursor: sessionActive ? 'default' : 'pointer',
              },
            }}
          />
        )}
        {showAction && (sessionActive ? endButton : startButton)}
      </Stack>

      {showPlayer && (
        <PlayerSelectDialog
          open={pickerOpen && !sessionActive}
          onClose={() => setPickerOpen(false)}
          onSelect={setSelected}
          players={options}
          selected={selected}
          testIdPrefix={dialogTestId}
        />
      )}
      {showPlayer && (
        <MediaSelectDialog
          open={mediaPickerOpen && !sessionActive}
          onClose={() => setMediaPickerOpen(false)}
          onSelect={(item) => setSelectedMediaId(item.mediaId)}
          media={mediaOptions}
          selectedMediaId={selectedMediaId}
          testIdPrefix={mediaDialogTestId}
        />
      )}
    </>
  )
}
