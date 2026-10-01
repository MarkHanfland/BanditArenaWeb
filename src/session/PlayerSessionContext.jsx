import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { endSession, getCurrentSession, resumeSession, startSession } from '../api/device'
import { CORE_LIMITS, ageYears, evaluateCloudStart, evaluateEligibility, profileFromUser } from './sessionStartGate'
import { listCatalogModels, listMedia, listUsers } from '../api/cloud'

/** Treadmill model whose published eligibility limits this console applies (FR-SW-SVC-017). */
const DEVICE_PRODUCT_ID = import.meta.env?.VITE_DEVICE_PRODUCT_ID || 'bandit-arena-core'
import { readLastPlayers, rememberPlayer } from './lastPlayers'
import { formatSessionClock, sessionPhaseFrom, SESSION_PHASE, SESSION_PHASE_LABEL } from './playerSessionPhase'

const PlayerSessionContext = createContext(null)

export function PlayerSessionProvider({ children, deviceOnline = true, onSessionStarted }) {
  const [session, setSession] = useState(null)
  const [players, setPlayers] = useState([])
  const [mediaOptions, setMediaOptions] = useState([])
  const [selectedMediaId, setSelectedMediaId] = useState('')
  const [lastPlayers, setLastPlayers] = useState(readLastPlayers)
  const [selected, setSelected] = useState(null)
  const [eligibilityLimits, setEligibilityLimits] = useState(CORE_LIMITS)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const clientStartedAtRef = useRef(null)
  const pollGenerationRef = useRef(0)

  const refreshSession = useCallback(async () => {
    const generation = pollGenerationRef.current
    const { data } = await getCurrentSession()
    if (generation !== pollGenerationRef.current) {
      return
    }
    if (data) {
      setSession(data)
      if (data.pendingRestart) {
        setMessage('Player stop — the tread stays at zero until restart is confirmed.')
      } else if (data.sessionEndCause === 'tread_exit') {
        setMessage('The player left the tread. The session ended.')
      } else if (data.sessionEndCause === 'cloud_loss' || data.sessionEndCause === 'cloud_unavailable') {
        setMessage('cloud unavailable')
      }
    }
  }, [])

  const loadPlayers = useCallback(async () => {
    const { data, error } = await listUsers()
    if (error) {
      setPlayers([])
      setMessage(`Could not load enrolled players: ${error}`)
      return
    }
    const enrolled = (data?.users || []).filter((user) => user.enrollmentState === 'active')
    setPlayers(enrolled)
    if (enrolled.length === 0) {
      setMessage((prev) =>
        prev?.startsWith('Could not load enrolled players:')
          ? prev
          : 'No active enrolled players. Seed demo users or activate a user under Users.',
      )
    } else {
      setMessage((prev) =>
        prev === 'No active enrolled players. Seed demo users or activate a user under Users.'
          ? ''
          : prev,
      )
    }
  }, [])

  // FR-SW-SAFE-010 / SVC-017: use the model's published limits; the device stays authoritative.
  useEffect(() => {
    let active = true
    listCatalogModels().then(({ data }) => {
      const model = (data?.products || []).find((p) => p.productId === DEVICE_PRODUCT_ID)
      if (active && model?.eligibility) setEligibilityLimits({ ...CORE_LIMITS, ...model.eligibility })
    })
    return () => {
      active = false
    }
  }, [])

  const loadMedia = useCallback(async () => {
    const { data, error } = await listMedia()
    if (error) {
      setMediaOptions([])
      return
    }
    const published = (data?.media || []).filter(
      (item) => item.status !== 'unpublished' && item.mediaId,
    )
    setMediaOptions(published)
    setSelectedMediaId((prev) => {
      if (prev && published.some((m) => m.mediaId === prev)) {
        return prev
      }
      return published[0]?.mediaId || ''
    })
  }, [])

  useEffect(() => {
    loadPlayers()
    loadMedia()
  }, [loadPlayers, loadMedia])

  useEffect(() => {
    if (!deviceOnline) {
      return undefined
    }
    refreshSession()
    const interval = setInterval(refreshSession, 2000)
    return () => clearInterval(interval)
  }, [deviceOnline, refreshSession])

  useEffect(() => {
    if (session?.active && session.userId) {
      setSelected((prev) => {
        if (prev?.userId === session.userId) {
          return prev
        }
        return {
          userId: session.userId,
          displayName: session.displayName || session.userId,
        }
      })
      if (session.mediaId) {
        setSelectedMediaId(session.mediaId)
      }
      return
    }
    if (!session?.active && !selected && lastPlayers[0]) {
      setSelected(lastPlayers[0])
    }
  }, [session?.active, session?.userId, session?.displayName, session?.mediaId, lastPlayers, selected])

  useEffect(() => {
    if (!session?.active) {
      clientStartedAtRef.current = null
      return undefined
    }
    if (session.startedAt) {
      clientStartedAtRef.current = Number(session.startedAt)
    } else if (!clientStartedAtRef.current) {
      clientStartedAtRef.current = Date.now()
    }
    setNowMs(Date.now())
    const interval = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [session?.active, session?.startedAt])

  const options = useMemo(() => {
    const byId = new Map()
    lastPlayers.forEach((player) => {
      byId.set(player.userId, { ...player, recent: true })
    })
    players.forEach((player) => {
      const existing = byId.get(player.userId)
      byId.set(player.userId, {
        ...player,
        displayName: player.name || existing?.displayName,
        recent: Boolean(existing?.recent),
      })
    })
    return Array.from(byId.values())
  }, [lastPlayers, players])

  const sessionActive = Boolean(session?.active)
  const phase = sessionPhaseFrom({ session, selected })
  const selectedMedia = useMemo(
    () => mediaOptions.find((item) => item.mediaId === selectedMediaId) || null,
    [mediaOptions, selectedMediaId],
  )
  const selectedMediaIsTest = Boolean(
    selectedMedia?.testMedia
    || selectedMedia?.mediaCategory === 'test_simulation'
    || String(selectedMediaId || '').startsWith('media-sim-'),
  )
  const trackingReady = session?.trackingReady !== false
  const trackingBlocked = Boolean(session && session.trackingReady === false)

  const startedAtMs = sessionActive
    ? Number(session?.startedAt) || clientStartedAtRef.current
    : null
  const reportedDuration = Number(session?.durationSec)
  const elapsedSec = sessionActive && startedAtMs
    ? Math.max(
      0,
      Math.floor((nowMs - startedAtMs) / 1000),
      Number.isFinite(reportedDuration) ? reportedDuration : 0,
    )
    : null

  const statusNotice = useMemo(() => {
    if (busy) {
      return message || (selectedMediaIsTest
        ? 'Starting camera simulator…'
        : 'Starting session…')
    }
    if (message) {
      return message
    }
    // Only after a session is active and tracking has failed — never while idle.
    if (sessionActive && trackingBlocked) {
      return 'Waiting for high-confidence skeleton tracking'
    }
    return ''
  }, [busy, message, selectedMediaIsTest, sessionActive, trackingBlocked])

  const startForPlayer = useCallback(async ({ userId, displayName, ageAttested = false, mediaId, user, cloudReachable = true, measuredHeightM = null }) => {
    if (!mediaId) {
      setMessage('Select a media title before starting a session')
      return false
    }
    const media = mediaOptions.find((item) => item.mediaId === mediaId)
    const isTestMedia = Boolean(
      media?.testMedia
      || media?.mediaCategory === 'test_simulation'
      || String(mediaId).startsWith('media-sim-'),
    )
    if (!isTestMedia) {
      const decision = user
        ? evaluateCloudStart({
          cloudReachable,
          eligibility: evaluateEligibility({ ...profileFromUser(user), measuredHeightM, limits: eligibilityLimits }),
        })
        : { allow: false, message: 'Profile is missing height, weight, or date of birth' }
      if (!decision.allow) {
        setMessage(decision.message)
        return { ok: false, message: decision.message }
      }
    }
    setBusy(true)
    setMessage('')
    pollGenerationRef.current += 1
    const profile = user ? { ...profileFromUser(user), ageYears: ageYears(user.dateOfBirth), cloudReachable, measuredHeightM } : null
    const { data, error } = await startSession({
      userId,
      displayName,
      ageAttested,
      mediaId,
      profile,
      testMedia: isTestMedia,
      simulationMode: media?.simulationMode || (isTestMedia ? 'deterministic' : ''),
      deterministicConfig: media?.deterministicConfig || '',
      capabilities: Array.isArray(media?.capabilities)
        ? media.capabilities
        : (isTestMedia ? ['simulation'] : []),
    })
    if (error) {
      setMessage(error)
      setBusy(false)
      return false
    }

    // Session records are written by the device with its certificate (FR-SW-SVC-010,
    // FR-SW-AUTH-010: Domain 10 writes are device only). The console never opens or
    // closes a cloud session record itself.
    const cloudOpenError = data?.cloudLinked
      ? null
      : 'This device did not record the session in the cloud; it will not appear in Session History.'
    if (cloudOpenError) setMessage(data?.cloudWarning || cloudOpenError)

    pollGenerationRef.current += 1
    clientStartedAtRef.current = Number(data?.startedAt) || Date.now()
    setNowMs(Date.now())
    setSession(data)
    rememberPlayer({ userId: data?.userId || userId, displayName: data?.displayName || displayName })
    setLastPlayers(readLastPlayers())
    setSelected({
      userId: data?.userId || userId,
      displayName: data?.displayName || displayName,
    })
    if (data?.mediaId) {
      setSelectedMediaId(data.mediaId)
    }
    if (data?.cloudWarning && !cloudOpenError) {
      setMessage(data.cloudWarning)
    }
    setBusy(false)
    onSessionStarted?.()
    return true
  }, [eligibilityLimits, mediaOptions, onSessionStarted])

  const handleStart = useCallback(async () => {
    if (!selected?.userId) {
      return false
    }
    // The header selection may hold only userId/displayName; the eligibility gate
    // needs the enrolled record with its safety profile and date of birth.
    const user = players.find((p) => p.userId === selected.userId) || selected
    return startForPlayer({
      userId: selected.userId,
      displayName: selected.displayName || selected.name || selected.email || selected.userId,
      ageAttested: Boolean(user.ageAttested ?? selected.ageAttested),
      mediaId: selectedMediaId,
      user,
    })
  }, [players, selected, selectedMediaId, startForPlayer])

  const resumePlayer = useCallback(async () => {
    const { data, error } = await resumeSession({
      trackingOk: Boolean(session?.trackingReady),
      upright: true,
      inDeadZone: true,
      confirmed: true,
      cloudReachable: typeof navigator === 'undefined' ? true : navigator.onLine,
    })
    if (error) {
      setMessage(error)
      return
    }
    if (data) setSession(data)
    setMessage(data?.pendingRestart ? 'Restart is not confirmed' : '')
  }, [session])

  const handleEnd = useCallback(async () => {
    setBusy(true)
    setMessage('')
    pollGenerationRef.current += 1
    const { data, error } = await endSession()
    if (error) {
      setMessage(error)
    } else {
      setSession(data)
      setSelected(null)
      clientStartedAtRef.current = null
    }
    setBusy(false)
  }, [])

  const value = useMemo(
    () => ({
      session,
      selected,
      setSelected,
      options,
      mediaOptions,
      selectedMediaId,
      setSelectedMediaId,
      selectedMedia,
      selectedMediaIsTest,
      trackingReady,
      trackingBlocked,
      statusNotice,
      lastPlayers,
      players,
      busy,
      message,
      sessionActive,
      phase,
      phaseLabel: SESSION_PHASE_LABEL[phase],
      elapsedSec,
      formattedElapsed: formatSessionClock(elapsedSec),
      startForPlayer,
      resumePlayer,
      handleStart,
      handleEnd,
      loadPlayers,
      loadMedia,
      refreshSession,
    }),
    [
      session,
      selected,
      options,
      mediaOptions,
      selectedMediaId,
      selectedMedia,
      selectedMediaIsTest,
      trackingReady,
      trackingBlocked,
      statusNotice,
      lastPlayers,
      players,
      busy,
      message,
      sessionActive,
      phase,
      elapsedSec,
      startForPlayer,
      resumePlayer,
      handleStart,
      handleEnd,
      loadPlayers,
      loadMedia,
      refreshSession,
    ],
  )

  return <PlayerSessionContext.Provider value={value}>{children}</PlayerSessionContext.Provider>
}

export function usePlayerSession() {
  const ctx = useContext(PlayerSessionContext)
  if (!ctx) {
    throw new Error('usePlayerSession must be used within PlayerSessionProvider')
  }
  return ctx
}

export { SESSION_PHASE, SESSION_PHASE_LABEL, formatSessionClock }
