import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Stack, Typography } from '@mui/material'
import { projectLatLng } from '../../../data/fleetDemoCatalog'
import {
  clusterPins,
  fleetPinStatus,
  mapboxAccessToken,
  pinColor,
  venueCoordinates,
} from '../../../geo/fleetMapPins'

function MapboxFleetMap({ venues, devices, selectedVenueId, onSelectVenue, height, accent }) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const token = mapboxAccessToken()
    if (!token || !hostRef.current) return undefined
    let cancelled = false
    let map
    import('mapbox-gl')
      .then((mod) => import('mapbox-gl/dist/mapbox-gl.css').then(() => mod))
      .then((mod) => {
        if (cancelled || !hostRef.current) return
        const mapboxgl = mod.default || mod
        mapboxgl.accessToken = token
        const features = venues
          .map((venue) => {
            const coords = venueCoordinates(venue)
            if (!coords) return null
            const atVenue = devices.filter((d) => d.venueId === venue.venueId)
            return {
              type: 'Feature',
              properties: {
                venueId: venue.venueId,
                name: venue.name || venue.city || venue.venueId,
                status: fleetPinStatus(atVenue),
              },
              geometry: { type: 'Point', coordinates: [coords.longitude, coords.latitude] },
            }
          })
          .filter(Boolean)
        map = new mapboxgl.Map({
          container: hostRef.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: features[0]?.geometry.coordinates || [-96, 37.8],
          zoom: features.length ? 3.4 : 2.8,
          attributionControl: false,
        })
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
        map.on('load', () => {
          map.addSource('venues', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features },
            cluster: true,
            clusterMaxZoom: 10,
            clusterRadius: 42,
          })
          map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'venues',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': accent?.pin || '#7FDBCA',
              'circle-radius': ['step', ['get', 'point_count'], 14, 4, 18, 8, 22],
              'circle-opacity': 0.85,
            },
          })
          map.addLayer({
            id: 'unclustered',
            type: 'circle',
            source: 'venues',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': [
                'match',
                ['get', 'status'],
                'lockout',
                '#E53935',
                'maintenance',
                '#FB8C00',
                'offline',
                '#FDD835',
                'online',
                '#43A047',
                'active',
                '#43A047',
                accent?.pin || '#7FDBCA',
              ],
              'circle-radius': 7,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            },
          })
          map.on('click', 'unclustered', (event) => {
            const venueId = event.features?.[0]?.properties?.venueId
            if (venueId) onSelectVenue?.(venueId)
          })
          map.on('click', 'clusters', (event) => {
            const feature = event.features?.[0]
            const source = map.getSource('venues')
            source.getClusterExpansionZoom(feature.properties.cluster_id, (err, zoom) => {
              if (err) return
              map.easeTo({ center: feature.geometry.coordinates, zoom })
            })
          })
          if (selectedVenueId) {
            const selected = features.find((f) => f.properties.venueId === selectedVenueId)
            if (selected) map.easeTo({ center: selected.geometry.coordinates, zoom: 8 })
          }
        })
        mapRef.current = map
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
    }
  }, [venues, devices, selectedVenueId, onSelectVenue, accent])

  if (failed) return null
  return <Box ref={hostRef} data-testid="fleet-mapbox" sx={{ position: 'absolute', inset: 0 }} />
}

/**
 * Staff Fleet map: Mapbox GL when VITE_MAPBOX_ACCESS_TOKEN is set,
 * otherwise venue-list pins and an unavailable banner (FR-SW-UI-012).
 */
export default function FleetMapView({
  venues = [],
  devices = [],
  selectedVenueId,
  accent,
  onSelectVenue,
  height = 280,
}) {
  const token = mapboxAccessToken()
  const pins = useMemo(
    () =>
      venues
        .map((venue) => {
          const coords = venueCoordinates(venue)
          if (!coords) return null
          const { x, y } = projectLatLng(coords.latitude, coords.longitude, 100, 100)
          const atVenue = devices.filter((d) => d.venueId === venue.venueId)
          return {
            ...venue,
            ...coords,
            x,
            y,
            status: fleetPinStatus(atVenue),
          }
        })
        .filter(Boolean),
    [venues, devices],
  )
  const clusters = useMemo(() => clusterPins(pins), [pins])

  return (
    <Box
      data-testid="fleet-map"
      sx={{
        position: 'relative',
        height,
        borderRadius: 2,
        overflow: 'hidden',
        background: accent?.wash || 'linear-gradient(160deg, #1a2330, #2c3e50)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.35)',
      }}
    >
      {token ? (
        <MapboxFleetMap
          venues={venues}
          devices={devices}
          selectedVenueId={selectedVenueId}
          onSelectVenue={onSelectVenue}
          height={height}
          accent={accent}
        />
      ) : (
        <>
          <Alert
            severity="info"
            data-testid="fleet-map-unavailable"
            sx={{
              position: 'absolute',
              left: 10,
              right: 10,
              top: 10,
              zIndex: 4,
              py: 0.25,
              bgcolor: 'rgba(8,12,16,0.82)',
              color: '#fff',
              '& .MuiAlert-icon': { color: '#7FDBCA' },
            }}
          >
            Map unavailable — Mapbox token not configured. Venue list remains below.
          </Alert>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.28 }}
          >
            <path
              d="M12,32 L18,28 L28,30 L38,26 L48,28 L58,24 L70,26 L82,30 L88,38 L86,48 L80,58 L72,66 L60,72 L48,74 L36,70 L24,64 L16,52 L12,40 Z"
              fill="rgba(255,255,255,0.12)"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="0.4"
            />
          </svg>
          {clusters.map((cluster) => {
            const primary = cluster.venues[0]
            const selected = cluster.venues.some((v) => v.venueId === selectedVenueId)
            const color = pinColor(primary.status, accent?.pin)
            return (
              <Box
                key={cluster.id}
                component="button"
                type="button"
                data-testid={`fleet-pin-${primary.venueId}`}
                onClick={() => onSelectVenue?.(primary.venueId)}
                title={cluster.venues.map((v) => v.name).join(', ')}
                sx={{
                  position: 'absolute',
                  left: `${cluster.x}%`,
                  top: `${cluster.y}%`,
                  transform: 'translate(-50%, -50%)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  zIndex: selected ? 3 : 2,
                  p: 0,
                }}
              >
                <Box
                  sx={{
                    width: selected ? 18 : 12,
                    height: selected ? 18 : 12,
                    borderRadius: '50%',
                    bgcolor: color,
                    boxShadow: selected
                      ? `0 0 0 6px ${color}33, 0 4px 14px rgba(0,0,0,0.45)`
                      : `0 0 0 3px ${color}44`,
                  }}
                />
                {cluster.venues.length > 1 && (
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      top: -10,
                      right: -8,
                      bgcolor: '#111',
                      color: '#fff',
                      borderRadius: 1,
                      px: 0.4,
                      fontSize: 10,
                    }}
                  >
                    {cluster.venues.length}
                  </Typography>
                )}
                {selected && (
                  <Stack
                    spacing={0}
                    sx={{
                      position: 'absolute',
                      top: 22,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      minWidth: 140,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: 'rgba(8,12,16,0.85)',
                      color: '#fff',
                      pointerEvents: 'none',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {primary.city || primary.name}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.75, whiteSpace: 'nowrap' }}>
                      {primary.district || primary.formattedAddress || primary.status}
                    </Typography>
                  </Stack>
                )}
              </Box>
            )
          })}
        </>
      )}
    </Box>
  )
}
