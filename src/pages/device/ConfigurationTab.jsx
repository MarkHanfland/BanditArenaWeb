import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningIcon from '@mui/icons-material/Warning'
import SettingsIcon from '@mui/icons-material/Settings'
import ComputerIcon from '@mui/icons-material/Computer'
import DescriptionIcon from '@mui/icons-material/Description'
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun'
import HttpIcon from '@mui/icons-material/Http'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import TuneIcon from '@mui/icons-material/Tune'
import DeviceHubIcon from '@mui/icons-material/DeviceHub'
import { getConfig, updateConfig } from '../../api/device'

// Configuration section icons mapping
const sectionIcons = {
  machine: <ComputerIcon />,
  logging: <DescriptionIcon />,
  tread: <DirectionsRunIcon />,
  'rest facade': <HttpIcon />,
  'service management': <ManageAccountsIcon />,
  services: <SettingsIcon />,
}

// Field metadata for rendering appropriate controls
const fieldMetadata = {
  // Logging
  'log_level': { type: 'select', options: ['debug', 'info', 'warning', 'error'], label: 'Log Level' },
  'log_to_file': { type: 'boolean', label: 'Log to File' },
  'rotate_on_startup': { type: 'boolean', label: 'Rotate on Startup' },
  'max_log_file_size_mb': { type: 'number', min: 1, max: 100, label: 'Max Log File Size (MB)' },
  'max_log_file_count': { type: 'number', min: 1, max: 20, label: 'Max Log File Count' },
  
  // Tread
  'diameter_meters': { type: 'number', min: 1, max: 10, step: 0.1, label: 'Diameter (m)' },
  'safety_wall_thickness_meters': { type: 'number', min: 0.1, max: 1, step: 0.05, label: 'Safety Wall Thickness (m)' },
  'acceleration_meters_per_second': { type: 'number', min: 0.1, max: 5, step: 0.1, label: 'Acceleration (m/s²)' },
  'deceleration_in_meters_per_second': { type: 'number', min: 0.1, max: 5, step: 0.1, label: 'Deceleration (m/s²)' },
  'max_speed_in_meters_per_second': { type: 'number', min: 1, max: 15, step: 0.5, label: 'Max Speed (m/s)' },
  'maximum_degrees_actuator_tilt': { type: 'number', min: 0, max: 30, step: 1, label: 'Max Actuator Tilt (°)' },
  'camera_lens_horizontal_distance_to_center': { type: 'number', min: 0, max: 5, step: 0.01, label: 'Camera Distance to Center (m)' },
  'camera_lens_vertical_height': { type: 'number', min: 0, max: 5, step: 0.01, label: 'Camera Height (m)' },
  
  // REST
  'rest_enabled': { type: 'boolean', label: 'REST API Enabled' },
  'rest_api_port': { type: 'number', min: 1024, max: 65535, label: 'REST API Port' },
  
  // Service Management
  'heartbeat_interval_ms': { type: 'number', min: 100, max: 10000, label: 'Heartbeat Interval (ms)' },
  'heartbeat_timeout_seconds': { type: 'number', min: 1, max: 60, label: 'Heartbeat Timeout (s)' },
  'startup_grace_period_seconds': { type: 'number', min: 1, max: 120, label: 'Startup Grace Period (s)' },
  'startup_delay_ms': { type: 'number', min: 0, max: 5000, label: 'Startup Delay (ms)' },
  'max_restart_attempts': { type: 'number', min: 0, max: 10, label: 'Max Restart Attempts' },
  'restart_backoff_seconds': { type: 'number', min: 1, max: 60, label: 'Restart Backoff (s)' },
  
  // Service properties
  'enabled': { type: 'boolean', label: 'Enabled' },
  'createNewConsole': { type: 'boolean', label: 'Create New Console' },
  'update_rate_hz': { type: 'number', min: 1, max: 120, step: 1, label: 'Update Rate (Hz)' },
  'simulation_mode': { type: 'select', options: ['simple', 'intermediate', 'advanced', 'keyboard', 'replay'], label: 'Simulation Mode' },
  'walking_speed': { type: 'number', min: 0.1, max: 3, step: 0.1, label: 'Walking Speed (m/s)' },
  'jogging_speed': { type: 'number', min: 1, max: 5, step: 0.1, label: 'Jogging Speed (m/s)' },
  'running_speed': { type: 'number', min: 2, max: 10, step: 0.1, label: 'Running Speed (m/s)' },
  'movement_pattern': { type: 'select', options: ['stationary', 'circle', 'random_walk', 'back_and_forth', 'spiral', 'figure_eight'], label: 'Movement Pattern' },
  'initial_goal': { type: 'select', options: ['standing', 'walking', 'jogging', 'running'], label: 'Initial Goal' },
  'stationary_speed_threshold': { type: 'number', min: 0.01, max: 1, step: 0.01, label: 'Stationary Speed Threshold (m/s)' },
  'direction_smoothing_enabled': { type: 'boolean', label: 'Direction Smoothing Enabled' },
  'direction_smoothing_theta': { type: 'number', min: 0.01, max: 1, step: 0.01, label: 'Direction Smoothing Theta' },
  'position_correction_weight': { type: 'number', min: 0, max: 1, step: 0.05, label: 'Position Correction Weight' },
  'anticipatory_bias': { type: 'number', min: 0, max: 1, step: 0.05, label: 'Anticipatory Bias' },
  'dead_zone_radius': { type: 'number', min: 0, max: 0.5, step: 0.01, label: 'Dead Zone Radius (m)' },
  'max_correction_multiplier': { type: 'number', min: 1, max: 5, step: 0.1, label: 'Max Correction Multiplier' },
  'body_tracking_enabled': { type: 'boolean', label: 'Body Tracking Enabled' },
  'forensic_debug': { type: 'boolean', label: 'Forensic Debug Logging' },
  'source_mode': { type: 'select', options: ['live', 'replay'], label: 'Kinect Source Mode' },
  'depth_enabled': { type: 'boolean', label: 'Depth Enabled' },
  'color_enabled': { type: 'boolean', label: 'Color Enabled' },
  'point_cloud': { type: 'boolean', label: 'Point Cloud' },
  'recording_file': { type: 'string', label: 'Kinect MKV Recording File' },
  'recording_loop_enabled': { type: 'boolean', label: 'Recording Loop Enabled' },
  'skeleton_replay_file': { type: 'string', label: 'Skeleton Replay File' },
  'skeleton_replay_loop': { type: 'boolean', label: 'Skeleton Replay Loop' },
  'skeleton_replay_time_scale': { type: 'number', min: 0.01, max: 10, step: 0.01, label: 'Skeleton Replay Time Scale' },
  // User Simulator - Serialization/Replay
  'serialize_bones': { type: 'boolean', label: 'Serialize Bones to File' },
  'serialization_file': { type: 'string', label: 'Serialization File Path' },
  'replay_file': { type: 'string', label: 'Replay File Path' },
  'replay_loop': { type: 'boolean', label: 'Loop Replay' },
  // User Simulator - Keyboard
  'keyboard_forward': { type: 'string', label: 'Keyboard Forward Key' },
  'keyboard_back': { type: 'string', label: 'Keyboard Back Key' },
  'keyboard_left': { type: 'string', label: 'Keyboard Left Key' },
  'keyboard_right': { type: 'string', label: 'Keyboard Right Key' },
  'keyboard_turn_left': { type: 'string', label: 'Keyboard Turn Left Key' },
  'keyboard_turn_right': { type: 'string', label: 'Keyboard Turn Right Key' },
  'keyboard_jump': { type: 'string', label: 'Keyboard Jump Key' },
  'keyboard_run': { type: 'string', label: 'Keyboard Run Key' },
  'keyboard_acceleration_rate': { type: 'number', min: 1, max: 20, step: 0.5, label: 'Keyboard Acceleration Rate (m/s²)' },
  'keyboard_deceleration_rate': { type: 'number', min: 1, max: 20, step: 0.5, label: 'Keyboard Deceleration Rate (m/s²)' },
  'keyboard_turn_speed': { type: 'number', min: 0.5, max: 5, step: 0.1, label: 'Keyboard Turn Speed (rad/s)' },
}

// Render a single config field with appropriate control
function ConfigField({ fieldKey, value, onChange, disabled }) {
  const metadata = fieldMetadata[fieldKey] || {}
  const label = metadata.label || fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  
  // Determine field type from metadata or value
  let fieldType = metadata.type
  if (!fieldType) {
    if (value === 'true' || value === 'false' || typeof value === 'boolean') {
      fieldType = 'boolean'
    } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
      fieldType = 'number'
    } else {
      fieldType = 'string'
    }
  }

  const handleChange = (newValue) => {
    onChange(fieldKey, newValue)
  }

  switch (fieldType) {
    case 'boolean':
      const boolValue = value === 'true' || value === true
      return (
        <FormControlLabel
          control={
            <Switch
              checked={boolValue}
              onChange={(e) => handleChange(e.target.checked ? 'true' : 'false')}
              disabled={disabled}
              color="primary"
            />
          }
          label={label}
          sx={{ width: '100%', ml: 0 }}
        />
      )

    case 'select':
      return (
        <FormControl fullWidth size="small" disabled={disabled}>
          <InputLabel>{label}</InputLabel>
          <Select
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            label={label}
          >
            {(metadata.options || []).map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )

    case 'number':
      return (
        <TextField
          fullWidth
          size="small"
          label={label}
          type="number"
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          inputProps={{
            min: metadata.min,
            max: metadata.max,
            step: metadata.step || 1,
          }}
        />
      )

    default:
      return (
        <TextField
          fullWidth
          size="small"
          label={label}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
        />
      )
  }
}

// Service configuration card
function ServiceCard({ service, index, onUpdate, disabled }) {
  const [expanded, setExpanded] = useState(false)
  
  const handlePropertyChange = (key, value) => {
    const updatedService = { ...service }
    if (key === 'enabled' || key === 'createNewConsole') {
      updatedService[key] = value === 'true'
    } else if (key in (service.properties || {})) {
      updatedService.properties = { ...updatedService.properties, [key]: value }
    } else {
      updatedService[key] = value
    }
    onUpdate(index, updatedService)
  }

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        mb: 1, 
        p: 2,
        backgroundColor: service.enabled ? 'background.paper' : 'action.disabledBackground',
        opacity: service.enabled ? 1 : 0.7,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: expanded ? 2 : 0 }}>
        <Tooltip title="Startup sequence">
          <DragIndicatorIcon sx={{ color: 'text.secondary' }} />
        </Tooltip>
        
        <Chip 
          label={service.startupSequence} 
          size="small" 
          color="primary"
          sx={{ minWidth: 32 }}
        />
        
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {service.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {service.executablePath}
          </Typography>
        </Box>
        
        <FormControlLabel
          control={
            <Switch
              checked={service.enabled}
              onChange={(e) => handlePropertyChange('enabled', e.target.checked ? 'true' : 'false')}
              disabled={disabled}
              color="success"
            />
          }
          label={service.enabled ? 'Enabled' : 'Disabled'}
        />
        
        <IconButton onClick={() => setExpanded(!expanded)} size="small">
          <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </IconButton>
      </Box>
      
      {expanded && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {service.description}
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={service.createNewConsole}
                  onChange={(e) => handlePropertyChange('createNewConsole', e.target.checked ? 'true' : 'false')}
                  disabled={disabled}
                  size="small"
                />
              }
              label="Create New Console"
            />
            
            {service.properties && Object.entries(service.properties).map(([key, value]) => (
              <ConfigField
                key={key}
                fieldKey={key}
                value={value}
                onChange={(k, v) => handlePropertyChange(k, v)}
                disabled={disabled}
              />
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  )
}

function ConfigurationTab({ treadmillState = null }) {
  const [config, setConfig] = useState(null)
  const [originalConfig, setOriginalConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' })
  const [confirmDialog, setConfirmDialog] = useState(false)
  const [expandedSections, setExpandedSections] = useState({})
  const [activeTab, setActiveTab] = useState(0)
  const [apiConnected, setApiConnected] = useState(true)
  const [saveLockedUntilRestart, setSaveLockedUntilRestart] = useState(false)

  const isOperatingState = treadmillState === 2
  const saveBlockedReason = isOperatingState
    ? 'Configuration saves are disabled while treadmill state is OPERATING.'
    : (saveLockedUntilRestart
      ? 'Configuration has already been saved in this runtime. Restart Bandit Arena to save again.'
      : null)
  const isSaveBlocked = Boolean(saveBlockedReason)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error: apiError } = await getConfig()
      if (apiError || !data) {
        throw new Error(apiError || 'Failed to load configuration')
      }
      setConfig(data)
      setOriginalConfig(JSON.parse(JSON.stringify(data)))
      setHasChanges(false)
      setApiConnected(true)
      setError(null)
    } catch (err) {
      setError(err.message)
      setApiConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // Check for changes
  useEffect(() => {
    if (config && originalConfig) {
      setHasChanges(JSON.stringify(config) !== JSON.stringify(originalConfig))
    }
  }, [config, originalConfig])

  const handleSettingChange = (section, key, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
  }

  const handleServiceUpdate = (index, updatedService) => {
    setConfig(prev => {
      const newServices = [...prev.services]
      newServices[index] = updatedService
      return { ...prev, services: newServices }
    })
  }

  const handleCancel = () => {
    setConfig(JSON.parse(JSON.stringify(originalConfig)))
    setHasChanges(false)
    setSnackbar({ open: true, message: 'Changes discarded', severity: 'info' })
  }

  const handleSaveClick = () => {
    if (isSaveBlocked || saving) {
      return
    }
    setConfirmDialog(true)
  }

  const handleConfirmSave = async () => {
    setConfirmDialog(false)
    setSaving(true)
    
    try {
      const { data: result, error: apiError, status } = await updateConfig(config)

      if (apiError || status >= 400) {
        if (status === 423) {
          setSaveLockedUntilRestart(true)
        }
        if (status === 409) {
          setSnackbar({
            open: true,
            message: 'Configuration cannot be saved while treadmill state is OPERATING.',
            severity: 'warning',
          })
          return
        }
        throw new Error(apiError || result?.error || `HTTP error! status: ${status}`)
      }
      
      setOriginalConfig(JSON.parse(JSON.stringify(config)))
      setHasChanges(false)
      setSaveLockedUntilRestart(true)
      setSnackbar({ 
        open: true, 
        message: 'Configuration saved successfully. Restart Bandit Arena to apply changes.', 
        severity: 'success' 
      })
    } catch (err) {
      setSnackbar({ open: true, message: `Failed to save: ${err.message}`, severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!apiConnected || error) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="400px" gap={2}>
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Connection Lost
          </Typography>
          <Typography variant="body2">
            Unable to connect to Bandit Arena API. Please ensure the bandit_arena service is running.
            {error && <><br /><br />Error: {error}</>}
          </Typography>
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => {
            setApiConnected(true)
            setError(null)
            fetchConfig()
          }} 
          startIcon={<RefreshIcon />}
        >
          Retry Connection
        </Button>
      </Box>
    )
  }

  // Define settings sections for rendering
  const settingsSections = [
    { key: 'machine', title: 'Machine', icon: sectionIcons.machine },
    { key: 'logging', title: 'Logging', icon: sectionIcons.logging },
    { key: 'tread', title: 'Treadmill', icon: sectionIcons.tread },
    { key: 'rest facade', title: 'REST API', icon: sectionIcons['rest facade'] },
    { key: 'service management', title: 'Service Management', icon: sectionIcons['service management'] },
  ]

  // Sort services by startup sequence
  const sortedServices = config?.services ? 
    [...config.services].sort((a, b) => a.startupSequence - b.startupSequence) : []

  return (
    <Box>
      {/* Header with actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          System Configuration
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Reload configuration">
            <IconButton onClick={fetchConfig} disabled={saving}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={handleCancel}
            disabled={!hasChanges || saving}
          >
            Cancel
          </Button>
          
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveClick}
            disabled={!hasChanges || saving || isSaveBlocked}
            color="primary"
            data-testid="config-save"
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      {isSaveBlocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {saveBlockedReason}
        </Alert>
      )}

      {hasChanges && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have unsaved changes. Save or cancel before leaving this page.
        </Alert>
      )}

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            '& .MuiTab-root': {
              minHeight: 56,
              textTransform: 'none',
              fontSize: '0.95rem',
            }
          }}
        >
          <Tab 
            icon={<TuneIcon />} 
            iconPosition="start" 
            label="Bandit Arena" 
          />
          <Tab 
            icon={<DeviceHubIcon />} 
            iconPosition="start" 
            label="Services"
          />
        </Tabs>
      </Box>

      {/* Search - shown on both tabs */}
      <TextField
        fullWidth
        placeholder={activeTab === 0 ? "Search settings..." : "Search services..."}
        value={searchFilter}
        onChange={(e) => setSearchFilter(e.target.value)}
        sx={{ mb: 3 }}
        size="small"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {/* Tab Panel: Bandit Arena Configuration */}
      {activeTab === 0 && (
        <Box>
          {settingsSections.map(({ key, title, icon }) => {
            const sectionData = config?.[key]
            if (!sectionData) return null

            const filteredEntries = Object.entries(sectionData).filter(([k, v]) => {
              if (!searchFilter) return true
              const lowerFilter = searchFilter.toLowerCase()
              return k.toLowerCase().includes(lowerFilter) || 
                     String(v).toLowerCase().includes(lowerFilter)
            })

            if (searchFilter && filteredEntries.length === 0) return null

            return (
              <Accordion 
                key={key} 
                expanded={expandedSections[key] ?? true}
                onChange={() => toggleSection(key)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {icon}
                    <Typography sx={{ fontWeight: 500 }}>{title}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                    {filteredEntries.map(([fieldKey, value]) => (
                      <ConfigField
                        key={fieldKey}
                        fieldKey={fieldKey}
                        value={value}
                        onChange={(k, v) => handleSettingChange(key, k, v)}
                        disabled={saving}
                      />
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )
          })}
        </Box>
      )}

      {/* Tab Panel: Service Configuration */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Services are listed in startup order. Toggle services on/off and expand to configure properties.
          </Typography>
          
          {sortedServices.map((service) => {
            // Find original index in config.services
            const originalIndex = config.services.findIndex(s => s.name === service.name)
            
            if (searchFilter) {
              const lowerFilter = searchFilter.toLowerCase()
              const matchesSearch = 
                service.name.toLowerCase().includes(lowerFilter) ||
                service.description?.toLowerCase().includes(lowerFilter) ||
                service.executablePath?.toLowerCase().includes(lowerFilter) ||
                Object.entries(service.properties || {}).some(([k, v]) => 
                  k.toLowerCase().includes(lowerFilter) || 
                  String(v).toLowerCase().includes(lowerFilter)
                )
              if (!matchesSearch) return null
            }
            
            return (
              <ServiceCard
                key={service.name}
                service={service}
                index={originalIndex}
                onUpdate={handleServiceUpdate}
                disabled={saving}
              />
            )
          })}
        </Box>
      )}

      {/* Confirm Dialog */}
      <Dialog
        open={confirmDialog}
        onClose={() => setConfirmDialog(false)}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Confirm Configuration Save
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>Warning:</strong> Configuration changes require a full restart of Bandit Arena to take effect.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            The current configuration will be backed up before saving. Are you sure you want to save these changes?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmSave} variant="contained" color="primary" disabled={saving || isSaveBlocked}>
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ConfigurationTab
