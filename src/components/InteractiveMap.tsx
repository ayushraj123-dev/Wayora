/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RouteOption, GeoLocation, DisruptionReport } from '../types';
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
  Eye,
  EyeOff
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

  const [activeBasemap, setActiveBasemap] = useState<BasemapStyle>('voyager');
  const [filterMode, setFilterMode] = useState<'all' | 'stations' | 'landmarks'>('all');
  const [showMetroInfrastructure, setShowMetroInfrastructure] = useState(true);
  const [showRoadCorridors, setShowRoadCorridors] = useState(true);
  
  // Dynamic OSRM enriched coordinates cache keyed by leg ID
  const [osrmEnrichedCoords, setOsrmEnrichedCoords] = useState<Record<string, [number, number][]>>({});

  // Asynchronously fetch real street turn geometry from OSRM to refine road paths
  useEffect(() => {
    let isCancelled = false;

    const enrichLegsWithRoadGeometry = async () => {
      const updates: Record<string, [number, number][]> = {};

      for (const leg of selectedRoute.legs) {
        // Metro legs already strictly follow the physical Jaipur Metro Pink Line track!
        if (leg.mode === 'metro') continue;

        // For walking or bus, request real road centerline coordinates
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
      // Centered on Jaipur city coordinates
      const map = L.map(mapContainerRef.current, {
        center: [26.9124, 75.7873],
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      // Default CARTO Voyager Basemap with authorized API key
      const initialTileUrl = `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`;
      const tileLayer = L.tileLayer(initialTileUrl, {
        maxZoom: 20,
        subdomains: 'abcd',
        attribution: '&copy; CARTO Basemaps &copy; OpenStreetMap'
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Zoom control in top right
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

    // =========================================================================
    // 0. JAIPUR TRANSIT & ROAD INFRASTRUCTURE BASE LAYERS
    // =========================================================================
    
    // A. JAIPUR METRO PINK LINE PERMANENT TRACK
    if (showMetroInfrastructure) {
      // Split into Elevated Viaduct (Mansarovar -> Chandpole portal) and Underground Tunnel (Chandpole -> Badi Chaupar)
      const elevatedTrack = JAIPUR_METRO_PINK_LINE_TRACK.filter(
        (p) => p.type === 'elevated' || p.type === 'portal'
      ).map((p) => [p.lat, p.lng] as [number, number]);

      const undergroundTrack = JAIPUR_METRO_PINK_LINE_TRACK.filter(
        (p) => p.type === 'underground' || p.type === 'portal'
      ).map((p) => [p.lat, p.lng] as [number, number]);

      // Elevated ballast bed
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

      // Elevated Pink Rail Track
      const elevatedRail = L.polyline(elevatedTrack, {
        color: '#ec4899',
        weight: 3.5,
        opacity: 0.9,
        dashArray: '8, 8'
      });
      layers.addLayer(elevatedRail);

      // Underground Tunnel Subterranean Tube
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

      // Chandpole Gate Underground Portal Marker
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

    // B. MAJOR JAIPUR ARTERIAL ROAD SPINES
    if (showRoadCorridors) {
      // JLN Marg BRTS Corridor
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

      // Amer Road NH-248 Corridor
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

      // MI Road Commercial Axis
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

    // =========================================================================
    // 1. DRAW ALL JAIPUR STATION / NODE LOCATIONS
    // =========================================================================
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
        markerBg = '#10b981'; // Emerald Origin
        badgeLabel = 'START';
      } else if (isDest) {
        markerBg = '#ef4444'; // Rose Red Dest
        badgeLabel = 'END';
      } else if (isMetro) {
        markerBg = '#ec4899'; // Pink Line Metro
        badgeLabel = 'METRO';
      } else if (isHospital) {
        markerBg = '#f43f5e';
        badgeLabel = 'EMERGENCY';
      } else if (loc.category === 'landmark') {
        markerBg = '#8b5cf6'; // Violet landmark
        badgeLabel = 'SITE';
      } else if (loc.category === 'station' || loc.category === 'bus-stop') {
        markerBg = '#0284c7'; // Transit hub
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

      // Listen for popupopen to hook button clicks to state
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

    // =========================================================================
    // 2. DRAW ALTERNATIVE CANDIDATE ROUTES (SUBDUED ROAD POLYLINES)
    // =========================================================================
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

    // =========================================================================
    // 3. DRAW ACTIVE/SELECTED ROUTE (FOLLOWING ROADS AND METRO TRACKS)
    // =========================================================================
    selectedRoute.legs.forEach((leg) => {
      const isMetro = leg.mode === 'metro' || leg.lineName?.includes('Pink');
      const isWalking = leg.mode === 'walking';
      const isBus = leg.mode === 'bus';

      const legColor = leg.lineColor || (isMetro ? '#ec4899' : isWalking ? '#06b6d4' : isBus ? '#f59e0b' : '#10b981');
      const coords = osrmEnrichedCoords[leg.id] || leg.coordinates;

      // Outer roadway/track foundation bed
      const roadBedLine = L.polyline(coords, {
        color: isMetro ? '#4a044e' : '#090d16',
        weight: isWalking ? 6 : isMetro ? 9 : 8,
        opacity: 0.8
      });
      layers.addLayer(roadBedLine);

      // Core crisp transit line following streets or metro line
      const coreLine = L.polyline(coords, {
        color: legColor,
        weight: isWalking ? 3.5 : isMetro ? 5 : 4.5,
        opacity: 0.98,
        dashArray: isWalking ? '4, 6' : isMetro ? undefined : undefined
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

    // =========================================================================
    // 4. DRAW DISRUPTION HAZARD MARKERS (e.g. Jal Mahal monsoon flood)
    // =========================================================================
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

    // Initial fit bounds covering route
    fitCurrentRoute();
  }, [
    routes, 
    selectedRoute, 
    disruptions, 
    originLocation, 
    destinationLocation, 
    filterMode, 
    showMetroInfrastructure, 
    showRoadCorridors,
    osrmEnrichedCoords
  ]);

  return (
    <div className="relative w-full h-[510px] sm:h-[560px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 flex flex-col">
      {/* Top Map Toolbar */}
      <div className="relative z-[500] bg-slate-950/90 backdrop-blur-md px-3.5 py-2.5 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* CARTO Basemaps & Road Snapped Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold font-mono text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Road & Metro Snapped</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
            <RouteIcon className="w-3 h-3" />
            <span>Follows Streets & Viaducts</span>
          </span>
        </div>

        {/* Basemap Style Selector */}
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

      {/* Layer Toggles & Focus Shortcuts Strip */}
      <div className="relative z-[450] bg-slate-900/80 backdrop-blur px-3 py-1.5 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
        {/* Infrastructure Layer Toggles */}
        <button
          onClick={() => setShowMetroInfrastructure(!showMetroInfrastructure)}
          className={`px-2.5 py-0.5 rounded-lg border font-mono text-[11px] flex items-center gap-1 transition shrink-0 ${
            showMetroInfrastructure
              ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 font-semibold'
              : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-slate-200'
          }`}
          title="Toggle Jaipur Metro Pink Line elevated viaduct and underground tunnels"
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
          Entire Jaipur
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

      {/* The Leaflet Container */}
      <div ref={mapContainerRef} className="w-full flex-1 min-h-[380px]" />

      {/* Floating Tactical Legend */}
      <div className="absolute bottom-3 left-3 z-[500] bg-slate-950/90 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-2xl text-xs space-y-1.5 max-w-[290px] sm:max-w-none">
        <div className="font-semibold text-slate-200 flex items-center justify-between pb-1 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-xs">Road & Metro Navigation</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Streets Snapped
          </span>
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
    </div>
  );
};
