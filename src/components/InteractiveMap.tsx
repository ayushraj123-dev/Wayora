/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { RouteOption, GeoLocation, DisruptionReport, TransportMode } from '../types';
import { METRO_LOCATIONS } from '../data/transitNetwork';
import { 
  JAIPUR_METRO_PINK_LINE_TRACK,
  JLN_MARG_ROAD_CORRIDOR,
  AMER_ROAD_CORRIDOR,
  MI_ROAD_CENTRAL_CORRIDOR,
  fetchOSRMRoute
} from '../services/jaipurRoadGeometry';
import { 
  AlertTriangle, 
  Compass, 
  Layers, 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  Train, 
  Bus, 
  Building2, 
  Sparkles,
  Maximize2,
  Route as RouteIcon,
  Locate,
  LocateFixed,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  ArrowRight,
  Footprints,
  Car,
  ChevronRight,
  X
} from 'lucide-react';

const CARTO_API_KEY = 'cb1_4fqy_1_bace5320c179ab80bda30a26';

type BasemapStyle = 'voyager' | 'dark_all' | 'light_all';

interface InteractiveMapProps {
  routes: RouteOption[];
  selectedRoute: RouteOption;
  onSelectRoute: (route: RouteOption) => void;
  disruptions: DisruptionReport[];
  originLocation: GeoLocation;
  destinationLocation: GeoLocation;
  onSelectOrigin?: (location: GeoLocation) => void;
  onSelectDestination?: (location: GeoLocation) => void;
}

interface GpsManeuver {
  id: string;
  stepNumber: number;
  instruction: string;
  streetName: string;
  mode: TransportMode;
  maneuverType: 'depart' | 'turn-left' | 'turn-right' | 'straight' | 'board' | 'tunnel' | 'alight' | 'arrive';
  lat: number;
  lng: number;
  targetCoordIndex: number;
  targetDistanceMeters: number;
  speedKmh: number;
}

// Distance between two GPS points in meters
function haversineMeters(p1: [number, number], p2: [number, number]): number {
  const R = 6371e3;
  const phi1 = (p1[0] * Math.PI) / 180;
  const phi2 = (p2[0] * Math.PI) / 180;
  const deltaPhi = ((p2[0] - p1[0]) * Math.PI) / 180;
  const deltaLambda = ((p2[1] - p1[1]) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Compass bearing between two points
function calculateBearing(p1: [number, number], p2: [number, number]): number {
  const dLng = (p2[1] - p1[1]) * Math.cos((p1[0] * Math.PI) / 180);
  const dLat = p2[0] - p1[0];
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  return (angle + 360) % 360;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  routes,
  selectedRoute,
  onSelectRoute,
  disruptions,
  originLocation,
  destinationLocation,
  onSelectOrigin,
  onSelectDestination
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const realGpsMarkerRef = useRef<L.CircleMarker | null>(null);

  const [activeBasemap, setActiveBasemap] = useState<BasemapStyle>('voyager');
  const [filterMode, setFilterMode] = useState<'all' | 'stations' | 'landmarks'>('all');
  const [showMetroInfrastructure, setShowMetroInfrastructure] = useState(true);
  const [showRoadCorridors, setShowRoadCorridors] = useState(true);
  
  // Dynamic OSRM enriched coordinates cache keyed by leg ID
  const [osrmEnrichedCoords, setOsrmEnrichedCoords] = useState<Record<string, [number, number][]>>({});

  // =========================================================================
  // GPS GUIDANCE STATE
  // =========================================================================
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsProgressFraction, setGpsProgressFraction] = useState(0); // 0 to 1
  const [isGpsPaused, setIsGpsPaused] = useState(false);
  const [gpsSpeedMultiplier, setGpsSpeedMultiplier] = useState<1 | 2 | 4>(2);
  const [followCamera, setFollowCamera] = useState(true);
  const [voiceGuidance, setVoiceGuidance] = useState(false);
  const [realGpsLoc, setRealGpsLoc] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [realGpsLoading, setRealGpsLoading] = useState(false);
  const [gpsNotification, setGpsNotification] = useState<string | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastSpokenManeuverIdRef = useRef<string | null>(null);

  // Compile full continuous route coordinate polyline for GPS navigation
  const fullRouteCoordinates = useMemo<[number, number][]>(() => {
    const coords: [number, number][] = [];
    selectedRoute.legs.forEach((leg) => {
      const legCoords = osrmEnrichedCoords[leg.id] || leg.coordinates;
      legCoords.forEach((c) => {
        if (coords.length === 0 || coords[coords.length - 1][0] !== c[0] || coords[coords.length - 1][1] !== c[1]) {
          coords.push([c[0], c[1]]);
        }
      });
    });
    return coords.length >= 2 ? coords : [[originLocation.lat, originLocation.lng], [destinationLocation.lat, destinationLocation.lng]];
  }, [selectedRoute, osrmEnrichedCoords, originLocation, destinationLocation]);

  // Compute cumulative segment distances along full route
  const cumulativeDistances = useMemo(() => {
    const dists: number[] = [0];
    let total = 0;
    for (let i = 0; i < fullRouteCoordinates.length - 1; i++) {
      const d = haversineMeters(fullRouteCoordinates[i], fullRouteCoordinates[i + 1]);
      total += Math.max(1, d);
      dists.push(total);
    }
    return { dists, totalDistance: Math.max(10, total) };
  }, [fullRouteCoordinates]);

  // Turn-by-Turn Maneuvers along the journey
  const maneuvers = useMemo<GpsManeuver[]>(() => {
    const steps: GpsManeuver[] = [];
    let cumulativeMeters = 0;
    let stepCount = 1;

    selectedRoute.legs.forEach((leg, legIdx) => {
      const legCoords = osrmEnrichedCoords[leg.id] || leg.coordinates;
      const legDist = leg.distanceMeters;
      const isFirst = legIdx === 0;
      const isLast = legIdx === selectedRoute.legs.length - 1;

      if (isFirst) {
        steps.push({
          id: `step-${stepCount}`,
          stepNumber: stepCount++,
          instruction: `Depart from ${leg.from.name}`,
          streetName: leg.from.address?.split(',')[0] || 'Civic Pavement',
          mode: leg.mode,
          maneuverType: 'depart',
          lat: legCoords[0][0],
          lng: legCoords[0][1],
          targetCoordIndex: 0,
          targetDistanceMeters: cumulativeMeters,
          speedKmh: leg.mode === 'walking' ? 5 : 25
        });
      }

      if (leg.mode === 'metro') {
        steps.push({
          id: `step-${stepCount}`,
          stepNumber: stepCount++,
          instruction: `Board Jaipur Metro Pink Line at ${leg.from.name}`,
          streetName: 'Pink Line Elevated Viaduct & Underground Tunnel',
          mode: 'metro',
          maneuverType: 'board',
          lat: legCoords[0][0],
          lng: legCoords[0][1],
          targetCoordIndex: Math.floor(fullRouteCoordinates.length * 0.25),
          targetDistanceMeters: cumulativeMeters,
          speedKmh: 65
        });

        if (leg.to.id === 'badi-chaupar' || leg.from.id === 'chandpole-gate') {
          steps.push({
            id: `step-${stepCount}`,
            stepNumber: stepCount++,
            instruction: 'Enter Chandpole Gate Underground Subway Tunnel Portal',
            streetName: 'Chandpole to Badi Chaupar Subterranean Tube',
            mode: 'metro',
            maneuverType: 'tunnel',
            lat: 26.9242,
            lng: 75.8093,
            targetCoordIndex: Math.floor(fullRouteCoordinates.length * 0.55),
            targetDistanceMeters: cumulativeMeters + Math.round(legDist * 0.6),
            speedKmh: 55
          });
        }

        steps.push({
          id: `step-${stepCount}`,
          stepNumber: stepCount++,
          instruction: `Alight at ${leg.to.name} Station Concourse`,
          streetName: 'Underground Platform & Elevator Concourse',
          mode: 'metro',
          maneuverType: 'alight',
          lat: legCoords[legCoords.length - 1][0],
          lng: legCoords[legCoords.length - 1][1],
          targetCoordIndex: Math.floor(fullRouteCoordinates.length * 0.8),
          targetDistanceMeters: cumulativeMeters + legDist,
          speedKmh: 45
        });
      } else if (leg.mode === 'bus') {
        const isJLN = leg.lineName?.includes('9A') || leg.from.address?.includes('JLN') || leg.to.address?.includes('JLN');
        const street = isJLN ? 'JLN Marg Arterial BRTS Corridor' : leg.lineName?.includes('7') ? 'Amer Road Heritage Highway' : 'MI Road / Station Road';

        steps.push({
          id: `step-${stepCount}`,
          stepNumber: stepCount++,
          instruction: `Board ${leg.lineName || 'JCTSL Municipal Low-Floor Bus'}`,
          streetName: street,
          mode: 'bus',
          maneuverType: 'board',
          lat: legCoords[0][0],
          lng: legCoords[0][1],
          targetCoordIndex: Math.floor(fullRouteCoordinates.length * 0.3),
          targetDistanceMeters: cumulativeMeters,
          speedKmh: 35
        });

        steps.push({
          id: `step-${stepCount}`,
          stepNumber: stepCount++,
          instruction: `Follow ${street} towards ${leg.to.name}`,
          streetName: street,
          mode: 'bus',
          maneuverType: 'straight',
          lat: legCoords[Math.floor(legCoords.length / 2)][0],
          lng: legCoords[Math.floor(legCoords.length / 2)][1],
          targetCoordIndex: Math.floor(fullRouteCoordinates.length * 0.6),
          targetDistanceMeters: cumulativeMeters + Math.round(legDist * 0.5),
          speedKmh: 32
        });

        steps.push({
          id: `step-${stepCount}`,
          stepNumber: stepCount++,
          instruction: `Alight at curbside stop: ${leg.to.name}`,
          streetName: street,
          mode: 'bus',
          maneuverType: 'alight',
          lat: legCoords[legCoords.length - 1][0],
          lng: legCoords[legCoords.length - 1][1],
          targetCoordIndex: Math.floor(fullRouteCoordinates.length * 0.85),
          targetDistanceMeters: cumulativeMeters + legDist,
          speedKmh: 20
        });
      } else {
        // Walking maneuver
        if (legCoords.length >= 3) {
          steps.push({
            id: `step-${stepCount}`,
            stepNumber: stepCount++,
            instruction: `Turn along illuminated city walkway towards ${leg.to.name}`,
            streetName: leg.to.address?.split(',')[0] || 'Civic Walkway',
            mode: 'walking',
            maneuverType: 'turn-right',
            lat: legCoords[Math.floor(legCoords.length / 2)][0],
            lng: legCoords[Math.floor(legCoords.length / 2)][1],
            targetCoordIndex: Math.floor(fullRouteCoordinates.length * 0.4),
            targetDistanceMeters: cumulativeMeters + Math.round(legDist * 0.5),
            speedKmh: 5.2
          });
        }
      }

      if (isLast) {
        steps.push({
          id: `step-${stepCount}`,
          stepNumber: stepCount++,
          instruction: `Arrive at destination: ${leg.to.name}`,
          streetName: leg.to.address || 'Destination Gateway',
          mode: leg.mode,
          maneuverType: 'arrive',
          lat: legCoords[legCoords.length - 1][0],
          lng: legCoords[legCoords.length - 1][1],
          targetCoordIndex: fullRouteCoordinates.length - 1,
          targetDistanceMeters: cumulativeMeters + legDist,
          speedKmh: 0
        });
      }

      cumulativeMeters += legDist;
    });

    return steps;
  }, [selectedRoute, osrmEnrichedCoords, fullRouteCoordinates]);

  // Current interpolated GPS state
  const currentGpsState = useMemo(() => {
    const totalDist = cumulativeDistances.totalDistance;
    const currentMeters = gpsProgressFraction * totalDist;
    const { dists } = cumulativeDistances;

    // Find segment
    let segIdx = 0;
    while (segIdx < dists.length - 2 && dists[segIdx + 1] < currentMeters) {
      segIdx++;
    }

    const segStartDist = dists[segIdx];
    const segEndDist = dists[segIdx + 1] || totalDist;
    const segSpan = Math.max(1, segEndDist - segStartDist);
    const segT = Math.max(0, Math.min(1, (currentMeters - segStartDist) / segSpan));

    const p1 = fullRouteCoordinates[segIdx];
    const p2 = fullRouteCoordinates[Math.min(fullRouteCoordinates.length - 1, segIdx + 1)];

    const lat = p1[0] + (p2[0] - p1[0]) * segT;
    const lng = p1[1] + (p2[1] - p1[1]) * segT;
    const heading = calculateBearing(p1, p2);

    // Identify active maneuver
    let activeManeuver = maneuvers[0];
    let nextManeuver = maneuvers[1] || maneuvers[0];
    for (let i = 0; i < maneuvers.length; i++) {
      if (maneuvers[i].targetDistanceMeters <= currentMeters) {
        activeManeuver = maneuvers[i];
        nextManeuver = maneuvers[i + 1] || maneuvers[i];
      }
    }

    const distToNextManeuver = Math.max(0, Math.round(nextManeuver.targetDistanceMeters - currentMeters));
    const remainingMeters = Math.max(0, Math.round(totalDist - currentMeters));
    
    // Dynamic simulated speed
    const currentSpeed = activeManeuver.speedKmh > 0 ? activeManeuver.speedKmh : 24;
    const remainingMinutes = Math.max(1, Math.round((remainingMeters / 1000) / (currentSpeed / 60)));

    // Calculate ETA
    const now = new Date();
    now.setMinutes(now.getMinutes() + remainingMinutes);
    const etaStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      currentCoord: [lat, lng] as [number, number],
      heading,
      currentMeters,
      remainingMeters,
      activeManeuver,
      nextManeuver,
      distToNextManeuver,
      currentSpeed,
      remainingMinutes,
      etaStr
    };
  }, [gpsProgressFraction, cumulativeDistances, fullRouteCoordinates, maneuvers]);

  // Voice Speech Announcement
  const speakGuidance = (text: string) => {
    if (!voiceGuidance || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synth failure
    }
  };

  // Trigger voice announcement when entering a new maneuver
  useEffect(() => {
    if (!isGpsActive) return;
    const active = currentGpsState.activeManeuver;
    if (active && active.id !== lastSpokenManeuverIdRef.current) {
      lastSpokenManeuverIdRef.current = active.id;
      speakGuidance(`${active.instruction}. ${active.streetName}`);
    }
  }, [isGpsActive, currentGpsState.activeManeuver, voiceGuidance]);

  // Animation Loop for GPS Navigation progress
  useEffect(() => {
    if (!isGpsActive || isGpsPaused) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      lastTimestampRef.current = null;
      return;
    }

    const stepSimulation = (timestamp: number) => {
      if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
      const deltaSec = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      // Realistic speed progression in meters per second * speedMultiplier
      const speedMps = (currentGpsState.currentSpeed * 1000) / 3600;
      const simulatedDistanceAdvance = speedMps * deltaSec * (gpsSpeedMultiplier * 1.8);
      const totalDist = cumulativeDistances.totalDistance;
      const deltaFraction = simulatedDistanceAdvance / totalDist;

      setGpsProgressFraction((prev) => {
        const next = prev + deltaFraction;
        if (next >= 1) {
          setIsGpsPaused(true);
          setGpsNotification('Destination Reached! You have arrived at your journey endpoint.');
          speakGuidance(`You have arrived at your destination: ${destinationLocation.name}`);
          return 1;
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(stepSimulation);
    };

    animationFrameRef.current = requestAnimationFrame(stepSimulation);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isGpsActive, isGpsPaused, gpsSpeedMultiplier, currentGpsState.currentSpeed, cumulativeDistances.totalDistance, destinationLocation.name]);

  // Update or render GPS Puck on the map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!isGpsActive) {
      if (gpsMarkerRef.current) {
        map.removeLayer(gpsMarkerRef.current);
        gpsMarkerRef.current = null;
      }
      return;
    }

    const [lat, lng] = currentGpsState.currentCoord;
    const heading = currentGpsState.heading;

    const gpsPuckHtml = `
      <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
        <!-- Pulsing radar beacon aura -->
        <div style="
          position: absolute;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(6, 182, 212, 0.28);
          border: 1.5px solid rgba(6, 182, 212, 0.65);
          animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <!-- Directional heading beam cone -->
        <div style="
          position: absolute;
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-bottom: 24px solid rgba(6, 182, 212, 0.45);
          transform-origin: 50% 100%;
          transform: rotate(${heading}deg) translateY(-16px);
        "></div>
        <!-- High-Precision Center GPS Core -->
        <div style="
          position: relative;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #06b6d4;
          border: 3px solid #ffffff;
          box-shadow: 0 0 16px #06b6d4, 0 4px 10px rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Dynamic Arrowhead pointing in heading -->
          <div style="
            width: 0;
            height: 0;
            border-left: 4.5px solid transparent;
            border-right: 4.5px solid transparent;
            border-bottom: 9px solid #082f49;
            transform: rotate(${heading}deg);
          "></div>
        </div>
      </div>
    `;

    const gpsIcon = L.divIcon({
      className: 'gps-puck-icon',
      html: gpsPuckHtml,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });

    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.setLatLng([lat, lng]);
      gpsMarkerRef.current.setIcon(gpsIcon);
    } else {
      const marker = L.marker([lat, lng], { icon: gpsIcon, zIndexOffset: 1000 }).addTo(map);
      gpsMarkerRef.current = marker;
    }

    // Auto-center camera if followCamera is enabled
    if (followCamera) {
      map.panTo([lat, lng], { animate: true, duration: 0.35 });
    }
  }, [isGpsActive, currentGpsState.currentCoord, currentGpsState.heading, followCamera]);

  // Request browser Real GPS Geolocation
  const handleAcquireRealGps = () => {
    if (!navigator.geolocation) {
      setGpsNotification('Geolocation is not supported by your browser.');
      return;
    }
    setRealGpsLoading(true);
    setGpsNotification('Acquiring real-time GPS satellite signal...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRealGpsLoading(false);
        const { latitude, longitude, accuracy } = pos.coords;
        setRealGpsLoc({ lat: latitude, lng: longitude, accuracy });

        const map = mapInstanceRef.current;
        if (map) {
          if (realGpsMarkerRef.current) {
            map.removeLayer(realGpsMarkerRef.current);
          }
          const circle = L.circleMarker([latitude, longitude], {
            radius: 9,
            fillColor: '#3b82f6',
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9
          }).addTo(map);
          circle.bindPopup(`<b>Your Real GPS Position</b><br/>Accuracy: within ${Math.round(accuracy)}m`);
          realGpsMarkerRef.current = circle;

          // Check if user is in Jaipur region (around lat 26.9, lng 75.8)
          const inJaipur = Math.abs(latitude - 26.9124) < 0.5 && Math.abs(longitude - 75.7873) < 0.5;
          if (inJaipur) {
            map.flyTo([latitude, longitude], 15);
            setGpsNotification(`Real GPS locked in Jaipur (±${Math.round(accuracy)}m). Starting guidance!`);
          } else {
            setGpsNotification(`Real GPS acquired (${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°). Simulating Jaipur transit route.`);
          }
        }
      },
      (err) => {
        setRealGpsLoading(false);
        setGpsNotification(`GPS acquisition note: ${err.message}. Using high-precision Jaipur transit simulation.`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Start GPS guidance mode
  const startGpsGuidance = () => {
    setIsGpsActive(true);
    setIsGpsPaused(false);
    setGpsProgressFraction(0);
    setFollowCamera(true);
    lastSpokenManeuverIdRef.current = null;
    setGpsNotification('GPS Navigation Active. Follow turn-by-turn maneuvers.');
    speakGuidance(`Starting GPS navigation to ${destinationLocation.name} via ${selectedRoute.title}`);

    const map = mapInstanceRef.current;
    if (map && fullRouteCoordinates.length > 0) {
      map.flyTo(fullRouteCoordinates[0], 16, { duration: 1.2 });
    }
  };

  // Stop GPS guidance mode
  const stopGpsGuidance = () => {
    setIsGpsActive(false);
    setIsGpsPaused(false);
    setGpsProgressFraction(0);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    fitCurrentRoute();
  };

  // Jump to specific maneuver
  const jumpToManeuver = (maneuver: GpsManeuver) => {
    const fraction = maneuver.targetDistanceMeters / cumulativeDistances.totalDistance;
    setGpsProgressFraction(Math.max(0, Math.min(1, fraction)));
    speakGuidance(`${maneuver.instruction} on ${maneuver.streetName}`);
  };

  // Asynchronously fetch real street turn geometry from OSRM to refine road paths
  useEffect(() => {
    let isCancelled = false;

    const enrichLegsWithRoadGeometry = async () => {
      const updates: Record<string, [number, number][]> = {};

      for (const leg of selectedRoute.legs) {
        if (leg.mode === 'metro') continue;

        if (leg.from.id !== leg.to.id) {
          const osrmMode = leg.mode === 'walking' ? 'walking' : 'driving';
          const roadCoords = await fetchOSRMRoute(
            leg.from.lat,
            leg.from.lng,
            leg.to.lat,
            leg.to.lng,
            osrmMode
          );

          if (!isCancelled && roadCoords && roadCoords.length > 2) {
            updates[leg.id] = roadCoords;
          }
        }
      }

      if (!isCancelled && Object.keys(updates).length > 0) {
        setOsrmEnrichedCoords((prev) => ({ ...prev, ...updates }));
      }
    };

    enrichLegsWithRoadGeometry();

    return () => {
      isCancelled = true;
    };
  }, [selectedRoute]);

  // Switch basemap layer dynamically
  const switchBasemap = (style: BasemapStyle) => {
    setActiveBasemap(style);
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const tileUrl = `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`;
    const newTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap'
    }).addTo(mapInstanceRef.current);

    newTileLayer.bringToBack();
    tileLayerRef.current = newTileLayer;
  };

  // Quick focus shortcuts across Jaipur corridors
  const focusCorridor = (corridor: 'all' | 'pink_line' | 'walled_city' | 'jln_south' | 'amer_fort') => {
    const map = mapInstanceRef.current;
    if (!map) return;

    switch (corridor) {
      case 'all': {
        const bounds = L.latLngBounds(METRO_LOCATIONS.map((l) => [l.lat, l.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
        break;
      }
      case 'pink_line': {
        const metroStops = METRO_LOCATIONS.filter((l) =>
          ['mansarovar-terminal', 'jaipur-junction', 'sindhi-camp', 'chandpole-gate', 'badi-chaupar'].includes(l.id)
        );
        map.fitBounds(L.latLngBounds(metroStops.map((l) => [l.lat, l.lng])), { padding: [50, 50] });
        break;
      }
      case 'walled_city': {
        map.flyTo([26.9240, 75.8180], 15, { duration: 1.2 });
        break;
      }
      case 'jln_south': {
        const southStops = METRO_LOCATIONS.filter((l) =>
          ['sms-hospital', 'mnit-campus', 'wtp-malviya-nagar', 'airport-sanganer'].includes(l.id)
        );
        map.fitBounds(L.latLngBounds(southStops.map((l) => [l.lat, l.lng])), { padding: [40, 40] });
        break;
      }
      case 'amer_fort': {
        map.fitBounds(
          L.latLngBounds([
            [26.9450, 75.8350],
            [26.9900, 75.8600]
          ]),
          { padding: [40, 40] }
        );
        break;
      }
    }
  };

  // Fit current selected route
  const fitCurrentRoute = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const allCoords: [number, number][] = [
      [originLocation.lat, originLocation.lng],
      [destinationLocation.lat, destinationLocation.lng]
    ];
    selectedRoute.legs.forEach((leg) => {
      const coords = osrmEnrichedCoords[leg.id] || leg.coordinates;
      coords.forEach((c) => allCoords.push(c));
    });

    if (allCoords.length > 0) {
      map.fitBounds(allCoords, { padding: [60, 60], maxZoom: 15 });
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [26.9124, 75.7873],
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      const initialTileUrl = `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`;
      const tileLayer = L.tileLayer(initialTileUrl, {
        maxZoom: 20,
        subdomains: 'abcd',
        attribution: '&copy; CARTO Basemaps &copy; OpenStreetMap'
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      L.control.zoom({ position: 'topright' }).addTo(map);

      const layersGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update routes, Jaipur landmark markers, disruptions whenever selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layersGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    // 0. JAIPUR METRO PINK LINE PERMANENT TRACK
    if (showMetroInfrastructure) {
      const elevatedTrack = JAIPUR_METRO_PINK_LINE_TRACK.filter(
        (p) => p.type === 'elevated' || p.type === 'portal'
      ).map((p) => [p.lat, p.lng] as [number, number]);

      const undergroundTrack = JAIPUR_METRO_PINK_LINE_TRACK.filter(
        (p) => p.type === 'underground' || p.type === 'portal'
      ).map((p) => [p.lat, p.lng] as [number, number]);

      const elevatedBed = L.polyline(elevatedTrack, {
        color: '#334155',
        weight: 6,
        opacity: 0.65
      });
      elevatedBed.bindTooltip('Jaipur Metro Elevated Viaduct (New Sanganer Rd & Railway Corridor)', {
        sticky: true,
        className: 'bg-slate-900 text-pink-300 text-[11px] font-mono border border-pink-500/30 px-2 py-1 rounded shadow-lg'
      });
      layers.addLayer(elevatedBed);

      const elevatedRail = L.polyline(elevatedTrack, {
        color: '#ec4899',
        weight: 3.5,
        opacity: 0.9,
        dashArray: '8, 8'
      });
      layers.addLayer(elevatedRail);

      if (undergroundTrack.length > 1) {
        const tunnelBed = L.polyline(undergroundTrack, {
          color: '#1e1b4b',
          weight: 7,
          opacity: 0.75
        });
        tunnelBed.bindTooltip('Jaipur Metro Phase 1B Underground Subway Tunnel (Chandpole to Badi Chaupar / Hawa Mahal)', {
          sticky: true,
          className: 'bg-slate-900 text-purple-300 text-[11px] font-mono border border-purple-500/30 px-2 py-1 rounded shadow-lg'
        });
        layers.addLayer(tunnelBed);

        const tunnelRail = L.polyline(undergroundTrack, {
          color: '#a855f7',
          weight: 3.5,
          opacity: 0.95,
          dashArray: '4, 6'
        });
        layers.addLayer(tunnelRail);
      }

      const portalNode = JAIPUR_METRO_PINK_LINE_TRACK.find((n) => n.type === 'portal');
      if (portalNode) {
        const portalIcon = L.divIcon({
          className: 'portal-marker',
          html: `
            <div style="
              background: #581c87;
              border: 1.5px solid #d8b4fe;
              border-radius: 6px;
              color: white;
              font-size: 9px;
              font-weight: 800;
              padding: 2px 4px;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            ">
              TUNNEL PORTAL
            </div>
          `,
          iconSize: [80, 20],
          iconAnchor: [40, 10]
        });
        layers.addLayer(L.marker([portalNode.lat, portalNode.lng], { icon: portalIcon }));
      }
    }

    // MAJOR JAIPUR ARTERIAL ROAD SPINES
    if (showRoadCorridors) {
      const jlnPolyline = L.polyline(JLN_MARG_ROAD_CORRIDOR, {
        color: '#0284c7',
        weight: 3,
        opacity: 0.35
      });
      jlnPolyline.bindTooltip('JLN Marg Arterial Transit Corridor (Ram Niwas -> SMS -> MNIT -> WTP -> Airport -> Sitapura)', {
        sticky: true,
        className: 'bg-slate-900 text-sky-300 text-[11px] font-mono border border-sky-500/30 px-2 py-1 rounded shadow-lg'
      });
      layers.addLayer(jlnPolyline);

      const amerPolyline = L.polyline(AMER_ROAD_CORRIDOR, {
        color: '#f59e0b',
        weight: 3,
        opacity: 0.35
      });
      amerPolyline.bindTooltip('Amer Road Heritage Highway (Badi Chaupar -> Jal Mahal -> Amer Fort)', {
        sticky: true,
        className: 'bg-slate-900 text-amber-300 text-[11px] font-mono border border-amber-500/30 px-2 py-1 rounded shadow-lg'
      });
      layers.addLayer(amerPolyline);

      const miPolyline = L.polyline(MI_ROAD_CENTRAL_CORRIDOR, {
        color: '#10b981',
        weight: 2.5,
        opacity: 0.3
      });
      miPolyline.bindTooltip('MI Road Central Commercial Spine (Jaipur Junction -> Sindhi Camp -> Albert Hall)', {
        sticky: true,
        className: 'bg-slate-900 text-emerald-300 text-[11px] font-mono border border-emerald-500/30 px-2 py-1 rounded shadow-lg'
      });
      layers.addLayer(miPolyline);
    }

    // 1. DRAW ALL JAIPUR STATION / NODE LOCATIONS
    const visibleLocations = METRO_LOCATIONS.filter((loc) => {
      if (filterMode === 'stations') {
        return loc.category === 'station' || loc.category === 'metro-station' || loc.category === 'bus-stop';
      }
      if (filterMode === 'landmarks') {
        return loc.category === 'landmark' || loc.category === 'commercial' || loc.category === 'hospital';
      }
      return true;
    });

    visibleLocations.forEach((loc) => {
      const isOrigin = loc.id === originLocation.id;
      const isDest = loc.id === destinationLocation.id;
      const isMetro = loc.category === 'metro-station' || loc.id.includes('metro') || ['mansarovar-terminal', 'jaipur-junction', 'sindhi-camp', 'chandpole-gate', 'badi-chaupar'].includes(loc.id);
      const isHospital = loc.category === 'hospital';

      let markerBg = '#0284c7';
      let badgeLabel = 'LOC';

      if (isOrigin) {
        markerBg = '#10b981';
        badgeLabel = 'START';
      } else if (isDest) {
        markerBg = '#ef4444';
        badgeLabel = 'END';
      } else if (isMetro) {
        markerBg = '#ec4899';
        badgeLabel = 'METRO';
      } else if (isHospital) {
        markerBg = '#f43f5e';
        badgeLabel = 'EMERGENCY';
      } else if (loc.category === 'landmark') {
        markerBg = '#8b5cf6';
        badgeLabel = 'SITE';
      } else if (loc.category === 'station' || loc.category === 'bus-stop') {
        markerBg = '#0284c7';
        badgeLabel = 'TRANSIT';
      }

      const isKeyEndpoint = isOrigin || isDest;
      const markerSize = isKeyEndpoint ? 32 : isMetro ? 26 : 22;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ${
              isKeyEndpoint
                ? `<div style="
                    position: absolute;
                    width: ${markerSize + 16}px;
                    height: ${markerSize + 16}px;
                    border-radius: 50%;
                    background: ${markerBg};
                    opacity: 0.35;
                    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                  "></div>`
                : ''
            }
            <div style="
              background: ${markerBg};
              width: ${markerSize}px;
              height: ${markerSize}px;
              border-radius: 50%;
              border: 2.5px solid #ffffff;
              box-shadow: 0 4px 14px rgba(0,0,0,0.45);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-family: 'Plus Jakarta Sans', sans-serif;
              font-weight: 800;
              font-size: ${isKeyEndpoint ? '11px' : '9px'};
              letter-spacing: -0.5px;
            ">
              ${isOrigin ? 'A' : isDest ? 'B' : isMetro ? 'M' : isHospital ? '+' : '●'}
            </div>
            <div style="
              position: absolute;
              bottom: -18px;
              white-space: nowrap;
              background: rgba(15, 23, 42, 0.92);
              color: #f8fafc;
              font-size: 10px;
              font-weight: 600;
              padding: 1px 6px;
              border-radius: 6px;
              border: 1px solid rgba(255,255,255,0.15);
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              pointer-events: none;
            ">
              ${loc.name.split('(')[0].trim().slice(0, 18)}
            </div>
          </div>
        `,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: customIcon });

      const popupHtml = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; color: #0f172a; padding: 6px 2px; min-width: 210px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="
              background: ${markerBg}20;
              color: ${markerBg};
              font-size: 10px;
              font-weight: 700;
              padding: 2px 7px;
              border-radius: 999px;
              text-transform: uppercase;
            ">${badgeLabel}</span>
            <span style="font-size: 10px; color: #64748b; font-weight: 600;">Jaipur Node</span>
          </div>
          <strong style="font-size: 13px; line-height: 1.3; display: block; color: #0f172a; margin-bottom: 2px;">
            ${loc.name}
          </strong>
          <span style="font-size: 11px; color: #475569; display: block; margin-bottom: 6px; line-height: 1.3;">
            ${loc.address || 'Jaipur Metropolitan Area'}
          </span>
          <div style="background: #f1f5f9; border-radius: 6px; padding: 4px 6px; font-size: 10px; color: #334155; margin-bottom: 8px; display: flex; justify-content: space-between;">
            <span>Safety: <strong>${loc.lightingScore || 90}%</strong></span>
            <span>${loc.hasElevator ? '✓ Step-Free Lift' : 'Ramp Access'}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="btn-origin-${loc.id}" style="
              flex: 1;
              background: #10b981;
              color: white;
              font-size: 11px;
              font-weight: 700;
              padding: 5px 8px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
            ">Set Origin</button>
            <button id="btn-dest-${loc.id}" style="
              flex: 1;
              background: #ef4444;
              color: white;
              font-size: 11px;
              font-weight: 700;
              padding: 5px 8px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
            ">Set Destination</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 260 });

      marker.on('popupopen', () => {
        const originBtn = document.getElementById(`btn-origin-${loc.id}`);
        const destBtn = document.getElementById(`btn-dest-${loc.id}`);

        if (originBtn && onSelectOrigin) {
          originBtn.onclick = (e) => {
            e.stopPropagation();
            onSelectOrigin(loc);
            marker.closePopup();
          };
        }

        if (destBtn && onSelectDestination) {
          destBtn.onclick = (e) => {
            e.stopPropagation();
            onSelectDestination(loc);
            marker.closePopup();
          };
        }
      });

      layers.addLayer(marker);
    });

    // 2. DRAW ALTERNATIVE CANDIDATE ROUTES
    routes.forEach((route) => {
      if (route.id === selectedRoute.id) return;

      route.legs.forEach((leg) => {
        const legCoords = osrmEnrichedCoords[leg.id] || leg.coordinates;
        const polyline = L.polyline(legCoords, {
          color: '#64748b',
          weight: 4,
          opacity: 0.35,
          dashArray: leg.mode === 'walking' ? '4, 6' : undefined
        });

        polyline.on('click', () => onSelectRoute(route));
        polyline.bindTooltip(
          `${route.title} (${route.totalDurationMinutes}m, ₹${route.totalCost}) • Snapped to Roads`,
          {
            sticky: true,
            className: 'bg-slate-900 text-white text-xs border border-slate-700 px-2 py-1 rounded'
          }
        );
        layers.addLayer(polyline);
      });
    });

    // 3. DRAW ACTIVE/SELECTED ROUTE (FOLLOWING ROADS AND METRO TRACKS)
    selectedRoute.legs.forEach((leg) => {
      const isMetro = leg.mode === 'metro' || leg.lineName?.includes('Pink');
      const isWalking = leg.mode === 'walking';
      const isBus = leg.mode === 'bus';

      const legColor = leg.lineColor || (isMetro ? '#ec4899' : isWalking ? '#06b6d4' : isBus ? '#f59e0b' : '#10b981');
      const coords = osrmEnrichedCoords[leg.id] || leg.coordinates;

      const roadBedLine = L.polyline(coords, {
        color: isMetro ? '#4a044e' : '#090d16',
        weight: isWalking ? 6 : isMetro ? 9 : 8,
        opacity: 0.8
      });
      layers.addLayer(roadBedLine);

      const coreLine = L.polyline(coords, {
        color: legColor,
        weight: isWalking ? 3.5 : isMetro ? 5 : 4.5,
        opacity: 0.98,
        dashArray: isWalking ? '4, 6' : undefined
      });

      const roadCorridorLabel = isMetro 
        ? 'Jaipur Metro Pink Line Track Viaduct & Underground Tunnel'
        : isBus 
          ? 'JCTSL Municipal Road Transit Corridor'
          : 'Jaipur Pedestrian Sidewalk & Civic Crossings';

      coreLine.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; color: #0f172a; padding: 4px;">
          <div style="font-size: 10px; font-weight: 800; color: ${legColor}; text-transform: uppercase;">
            ${isMetro ? 'Metro Track Alignment' : isBus ? 'Arterial Road Corridor' : isWalking ? 'Pedestrian Walkway' : 'Feeder Street Route'}
          </div>
          <strong style="font-size: 13px; color: #0f172a;">${leg.lineName || leg.mode.toUpperCase()}</strong><br/>
          <span style="font-size: 11px; color: #475569;">${leg.instructions}</span><br/>
          <div style="margin-top: 5px; font-size: 10px; font-weight: 600; color: #059669; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; display: inline-block;">
            ✓ Snapped: ${roadCorridorLabel}
          </div>
          <div style="margin-top: 4px; font-size: 11px; color: #0284c7; font-weight: 600;">
            Duration: ${leg.durationMinutes} mins • Fare: ₹${leg.cost} • Distance: ${(leg.distanceMeters / 1000).toFixed(1)} km
          </div>
        </div>
      `);
      layers.addLayer(coreLine);
    });

    // 4. DRAW DISRUPTION HAZARD MARKERS
    disruptions.forEach((dis) => {
      const hazardColor = dis.severity === 'critical' ? '#ef4444' : dis.severity === 'moderate' ? '#f59e0b' : '#38bdf8';
      const hazardIcon = L.divIcon({
        className: 'custom-hazard-marker',
        html: `
          <div style="
            background: #0f172a;
            border: 2px solid ${hazardColor};
            border-radius: 8px;
            padding: 3px 8px;
            display: flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 4px 12px ${hazardColor}80;
            color: ${hazardColor};
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
          ">
            <span>⚠ ${dis.category === 'flooding' ? 'MONSOON FLOOD' : 'SERVICE OUTAGE'}</span>
          </div>
        `,
        iconSize: [110, 26],
        iconAnchor: [55, 13]
      });

      const hazardMarker = L.marker([dis.lat, dis.lng], { icon: hazardIcon });
      hazardMarker.bindPopup(`
        <div style="color: #0f172a; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px;">
          <strong style="color: ${hazardColor}; font-size: 13px;">${dis.title}</strong><br/>
          <p style="font-size: 12px; margin: 4px 0; color: #334155;">${dis.description}</p>
          <div style="font-size: 10px; color: #64748b;">Status: <strong>${dis.status.toUpperCase()}</strong> • ${dis.upvotes} Community Verified Reports</div>
        </div>
      `);
      layers.addLayer(hazardMarker);
    });

    if (!isGpsActive) {
      fitCurrentRoute();
    }
  }, [
    routes, 
    selectedRoute, 
    disruptions, 
    originLocation, 
    destinationLocation, 
    filterMode, 
    showMetroInfrastructure, 
    showRoadCorridors,
    osrmEnrichedCoords,
    isGpsActive
  ]);

  // Maneuver Icon Helper
  const getManeuverIcon = (type: GpsManeuver['maneuverType'], mode: TransportMode) => {
    switch (type) {
      case 'turn-left':
        return <CornerUpLeft className="w-5 h-5 text-emerald-400" />;
      case 'turn-right':
        return <CornerUpRight className="w-5 h-5 text-emerald-400" />;
      case 'board':
        return mode === 'metro' ? <Train className="w-5 h-5 text-pink-400" /> : <Bus className="w-5 h-5 text-sky-400" />;
      case 'tunnel':
        return <Sparkles className="w-5 h-5 text-purple-400" />;
      case 'alight':
        return <ArrowRight className="w-5 h-5 text-amber-400" />;
      case 'arrive':
        return <MapPin className="w-5 h-5 text-rose-400" />;
      default:
        return <ArrowUp className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="relative w-full h-[540px] sm:h-[600px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 flex flex-col">
      {/* ===================================================================== */}
      {/* 1. TOP MAP TOOLBAR (DEFAULT / NON-GPS VIEW)                          */}
      {/* ===================================================================== */}
      {!isGpsActive && (
        <div className="relative z-[500] bg-slate-950/95 backdrop-blur-md px-3.5 py-2.5 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Left: GPS Navigation Launchers */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={startGpsGuidance}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/25 hover:brightness-110 active:scale-95 transition"
              title="Launch dynamic Turn-by-Turn GPS Guidance along snapped Jaipur roads and metro lines"
            >
              <Navigation className="w-3.5 h-3.5 fill-current" />
              <span>Start GPS Navigation</span>
            </button>

            <button
              onClick={handleAcquireRealGps}
              disabled={realGpsLoading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-mono text-[11px] transition"
              title="Acquire live browser satellite geolocation"
            >
              {realGpsLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              ) : realGpsLoc ? (
                <LocateFixed className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Locate className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{realGpsLoc ? 'GPS Locked' : 'My Device GPS'}</span>
            </button>
          </div>

          {/* Right: Basemap Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => switchBasemap('voyager')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                activeBasemap === 'voyager'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              CARTO Voyager
            </button>
            <button
              onClick={() => switchBasemap('dark_all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                activeBasemap === 'dark_all'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dark Matter
            </button>
            <button
              onClick={() => switchBasemap('light_all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                activeBasemap === 'light_all'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Positron
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. DYNAMIC TURN-BY-TURN GPS NAVIGATION HUD BANNER (WHEN GPS ACTIVE)    */}
      {/* ===================================================================== */}
      {isGpsActive && (
        <div className="relative z-[500] bg-slate-950/98 border-b border-emerald-500/30 shadow-2xl p-3 flex flex-col gap-2">
          {/* Main Directional Turn Card */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Maneuver Indicator with large directional arrow */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                {getManeuverIcon(currentGpsState.nextManeuver.maneuverType, currentGpsState.nextManeuver.mode)}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-mono font-bold text-sm">
                    In {currentGpsState.distToNextManeuver > 1000 ? `${(currentGpsState.distToNextManeuver / 1000).toFixed(1)} km` : `${currentGpsState.distToNextManeuver} m`}
                  </span>
                  <span className="text-slate-500 text-xs">•</span>
                  <span className="text-cyan-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
                    {currentGpsState.activeManeuver.mode.toUpperCase()} MODE
                  </span>
                </div>
                <span className="text-white font-bold text-sm sm:text-base leading-tight">
                  {currentGpsState.nextManeuver.instruction}
                </span>
                <span className="text-slate-400 text-xs">
                  {currentGpsState.nextManeuver.streetName}
                </span>
              </div>
            </div>

            {/* Tactical Telemetry & GPS HUD Controls */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Live Speedometer */}
              <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Speed</span>
                <span className="text-cyan-400 font-mono font-bold text-xs">{currentGpsState.currentSpeed} km/h</span>
              </div>

              {/* ETA Readout */}
              <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Arrival</span>
                <span className="text-emerald-400 font-mono font-bold text-xs">{currentGpsState.etaStr}</span>
              </div>

              {/* Voice Speech Toggle */}
              <button
                onClick={() => {
                  setVoiceGuidance(!voiceGuidance);
                  if (!voiceGuidance) speakGuidance('Voice guidance enabled.');
                }}
                className={`p-2 rounded-xl border transition ${
                  voiceGuidance ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title={voiceGuidance ? 'Mute Voice Guidance' : 'Enable Turn-by-Turn Voice Announcements'}
              >
                {voiceGuidance ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Follow Camera Toggle */}
              <button
                onClick={() => setFollowCamera(!followCamera)}
                className={`p-2 rounded-xl border transition ${
                  followCamera ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title={followCamera ? 'Camera Locked to GPS Puck' : 'Camera Free Pan'}
              >
                <LocateFixed className="w-4 h-4" />
              </button>

              {/* Speed Multiplier (1x, 2x, 4x) */}
              <button
                onClick={() => setGpsSpeedMultiplier((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
                className="px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 font-mono text-xs font-bold transition"
                title="Simulation Speed Multiplier"
              >
                {gpsSpeedMultiplier}x
              </button>

              {/* Pause / Resume */}
              <button
                onClick={() => setIsGpsPaused(!isGpsPaused)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition"
                title={isGpsPaused ? 'Resume Navigation' : 'Pause Navigation'}
              >
                {isGpsPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
              </button>

              {/* Exit GPS Navigation */}
              <button
                onClick={stopGpsGuidance}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Exit GPS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. LAYER TOGGLES & FOCUS CORRIDOR BAR                                */}
      {/* ===================================================================== */}
      {!isGpsActive && (
        <div className="relative z-[450] bg-slate-900/80 backdrop-blur px-3 py-1.5 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
          <button
            onClick={() => setShowMetroInfrastructure(!showMetroInfrastructure)}
            className={`px-2.5 py-0.5 rounded-lg border font-mono text-[11px] flex items-center gap-1 transition shrink-0 ${
              showMetroInfrastructure
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 font-semibold'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-slate-200'
            }`}
            title="Toggle Jaipur Metro Pink Line track infrastructure"
          >
            <Train className="w-3 h-3 text-pink-400" />
            <span>Pink Line Tracks</span>
          </button>

          <button
            onClick={() => setShowRoadCorridors(!showRoadCorridors)}
            className={`px-2.5 py-0.5 rounded-lg border font-mono text-[11px] flex items-center gap-1 transition shrink-0 ${
              showRoadCorridors
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-slate-200'
            }`}
            title="Toggle major arterial roads (JLN Marg, Amer Rd, MI Rd)"
          >
            <Bus className="w-3 h-3 text-sky-400" />
            <span>Road Arteries</span>
          </button>

          <span className="w-px h-3.5 bg-slate-800 mx-1 shrink-0" />

          <span className="text-slate-500 font-mono text-[10px] uppercase tracking-wider shrink-0 mr-0.5">
            Focus:
          </span>
          <button
            onClick={() => focusCorridor('all')}
            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shrink-0"
          >
            Jaipur All
          </button>
          <button
            onClick={() => focusCorridor('pink_line')}
            className="px-2 py-0.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 transition shrink-0"
          >
            Metro Corridor
          </button>
          <button
            onClick={() => focusCorridor('walled_city')}
            className="px-2 py-0.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 transition shrink-0"
          >
            Walled City
          </button>
          <button
            onClick={() => focusCorridor('jln_south')}
            className="px-2 py-0.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition shrink-0"
          >
            JLN Marg
          </button>
          <button
            onClick={() => focusCorridor('amer_fort')}
            className="px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition shrink-0"
          >
            Amer Fort
          </button>
          <button
            onClick={fitCurrentRoute}
            className="ml-auto px-2.5 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold transition shrink-0 flex items-center gap-1"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Fit Route</span>
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. NOTIFICATION BANNER / TOAST                                        */}
      {/* ===================================================================== */}
      {gpsNotification && (
        <div className="relative z-[460] bg-cyan-950/90 border-b border-cyan-500/30 px-3 py-1 flex items-center justify-between text-[11px] text-cyan-200 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span>{gpsNotification}</span>
          </div>
          <button onClick={() => setGpsNotification(null)} className="text-cyan-400 hover:text-white ml-2">
            ×
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. LEAFLET MAP CONTAINER                                              */}
      {/* ===================================================================== */}
      <div ref={mapContainerRef} className="w-full flex-1 min-h-[360px]" />

      {/* ===================================================================== */}
      {/* 6. BOTTOM GPS SCRUBBER & TURN-BY-TURN CONTROL DOCK (WHEN ACTIVE)     */}
      {/* ===================================================================== */}
      {isGpsActive ? (
        <div className="absolute bottom-3 left-3 right-3 z-[500] bg-slate-950/95 backdrop-blur-xl p-3 rounded-2xl border border-slate-800 shadow-2xl flex flex-col gap-2">
          {/* Progress bar scrubber with remaining distance */}
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-mono text-cyan-300 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {(currentGpsState.currentMeters / 1000).toFixed(1)} km traversed
            </span>
            <span className="font-mono text-slate-400">
              {(currentGpsState.remainingMeters / 1000).toFixed(1)} km left • {currentGpsState.remainingMinutes} min
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={1}
            step={0.002}
            value={gpsProgressFraction}
            onChange={(e) => setGpsProgressFraction(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          {/* Quick jump maneuver chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">Maneuvers:</span>
            {maneuvers.map((m, idx) => (
              <button
                key={m.id}
                onClick={() => jumpToManeuver(m)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-medium shrink-0 border transition flex items-center gap-1 ${
                  currentGpsState.activeManeuver.id === m.id
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <span>{idx + 1}. {m.instruction.slice(0, 18)}...</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Default Tactical Legend */
        <div className="absolute bottom-3 left-3 z-[500] bg-slate-950/90 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-2xl text-xs space-y-1.5 max-w-[290px] sm:max-w-none">
          <div className="font-semibold text-slate-200 flex items-center justify-between pb-1 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-xs">Jaipur GIS Mobility</span>
            </div>
            <button
              onClick={startGpsGuidance}
              className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-1"
            >
              <Navigation className="w-2.5 h-2.5" />
              <span>Launch GPS</span>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 pt-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300">Origin (Start)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-300">Destination (End)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-pink-500 rounded-sm" />
              <span className="text-slate-300">Metro Tracks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-sky-500 rounded-sm" />
              <span className="text-slate-300">JLN BRTS Bus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-amber-500 rounded-sm" />
              <span className="text-slate-300">Amer Highway</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-cyan-400 rounded-sm" />
              <span className="text-slate-300">Sidewalk Walk</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
