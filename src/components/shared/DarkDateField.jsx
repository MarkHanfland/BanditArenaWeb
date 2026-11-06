import React from 'react'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { InputAdornment, TextField } from '@mui/material'

/** Date field whose calendar icon stays light on the dark console. */
export default function DarkDateField({ testId, sx, ...props }) {
  return (
    <TextField
      size="small"
      type="date"
      InputLabelProps={{ shrink: true }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <CalendarMonthIcon sx={{ color: 'primary.light', pointerEvents: 'none' }} />
          </InputAdornment>
        ),
      }}
      inputProps={{ 'data-testid': testId, style: { colorScheme: 'dark' } }}
      sx={{
        minWidth: 180,
        '& input::-webkit-calendar-picker-indicator': {
          opacity: 0,
          position: 'absolute',
          right: 6,
          width: 28,
          height: 28,
          cursor: 'pointer',
        },
        ...sx,
      }}
      {...props}
    />
  )
}
