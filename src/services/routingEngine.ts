/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeoLocation, JourneyLeg, RouteOption, UserPreferences } from '../types';
import { METRO_LOCATIONS, TRANSIT_LINES } from '../data/transitNetwork';
import { getJaipurStreetSnappedPath } from './jaipurRoadGeometry';

// Haversine distance in meters
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Generate street and metro snapped path coordinates
function generatePathCoords(start: GeoLocation, end: GeoLocation, mode: JourneyLeg['mode'] = 'walking'): [number, number][] {
  return getJaipurStreetSnappedPath(start, end, mode);
}

export function getLocationById(id: string): GeoLocation | undefined {
  return METRO_LOCATIONS.find((loc) => loc.id === id);
}

export function generateCandidateRoutes(
  prefs: UserPreferences,
  disruptedStopIds: string[] = []
): RouteOption[] {
  const origin = getLocationById(prefs.originId) || METRO_LOCATIONS[0];
  const dest = getLocationById(prefs.destinationId) || METRO_LOCATIONS[3]; // SMS Hospital default

  if (origin.id === dest.id) {
    return [];
  }

  const directDistance = calculateDistanceMeters(origin.lat, origin.lng, dest.lat, dest.lng);
  const candidates: RouteOption[] = [];

  // ==========================================
  // CANDIDATE 1: DIRECT PEDESTRIAN / E-RICKSHAW HERITAGE CORRIDOR
  // ==========================================
  const walkDuration = Math.round((directDistance / 1000) * 12);
  const walkSafety = Math.round(((origin.lightingScore || 75) + (dest.lightingScore || 75)) / 2);

  const walkLeg: JourneyLeg = {
    id: `leg-walk-${Date.now()}-1`,
    mode: 'walking',
    from: origin,
    to: dest,
    distanceMeters: directDistance,
    durationMinutes: walkDuration,
    cost: 0,
    instructions: `Walk from ${origin.name} to ${dest.name} along illuminated Jaipur civic sidewalks and pedestrian arcades.`,
    isAccessible: origin.isWheelchairAccessible && dest.isWheelchairAccessible ? true : false,
    lightingQuality: walkSafety > 88 ? 'high' : walkSafety > 75 ? 'medium' : 'low',
    weatherResilient: !prefs.weatherAlertActive,
    coordinates: generatePathCoords(origin, dest, 'walking')
  };

  const walkOption: RouteOption = {
    id: 'route-pure-walk',
    title: 'Zero-Emission Pedestrian Heritage Walk',
    summary: 'Direct stroll through Jaipur avenues & heritage footpaths',
    categoryTag: 'Zero Carbon',
    totalDurationMinutes: walkDuration,
    totalCost: 0,
    walkingDistanceMeters: directDistance,
    walkingDurationMinutes: walkDuration,
    transfersCount: 0,
    co2SavedGrams: Math.round((directDistance / 1000) * 135),
    safetyScore: walkSafety,
    accessibilityScore: walkLeg.isAccessible ? 95 : 65,
    weatherRisk: prefs.weatherAlertActive ? 'high' : 'low',
    legs: [walkLeg],
    explanation: 'Zero fare and zero tailpipe emissions, optimal for short distances along JLN Marg or Walled City bazaars.',
    highlights: ['Zero monetary fare', '100% active healthy mobility', 'No transit wait times'],
    warnings: prefs.weatherAlertActive ? ['Aravalli monsoon showers active; outdoor pedestrian walking may be delayed.'] : [],
    isDemoData: true
  };

  if (directDistance <= 3200) {
    candidates.push(walkOption);
  }

  // ==========================================
  // CANDIDATE 2: JAIPUR METRO PINK LINE RAPID
  // ==========================================
  const metroStationIds = ['mansarovar-terminal', 'jaipur-junction', 'sindhi-camp', 'chandpole-gate', 'badi-chaupar'];
  const metroStations = metroStationIds.map((id) => getLocationById(id)!).filter(Boolean);

  const nearestOriginMetro = metroStations.reduce((closest, st) => {
    const dSt = calculateDistanceMeters(origin.lat, origin.lng, st.lat, st.lng);
    const dClosest = calculateDistanceMeters(origin.lat, origin.lng, closest.lat, closest.lng);
    return dSt < dClosest ? st : closest;
  }, metroStations[0]);

  const nearestDestMetro = metroStations.reduce((closest, st) => {
    const dSt = calculateDistanceMeters(dest.lat, dest.lng, st.lat, st.lng);
    const dClosest = calculateDistanceMeters(dest.lat, dest.lng, closest.lat, closest.lng);
    return dSt < dClosest ? st : closest;
  }, metroStations[metroStations.length - 1]);

  const originToMetroDist = calculateDistanceMeters(origin.lat, origin.lng, nearestOriginMetro.lat, nearestOriginMetro.lng);
  const destFromMetroDist = calculateDistanceMeters(nearestDestMetro.lat, nearestDestMetro.lng, dest.lat, dest.lng);
  const metroRideDist = calculateDistanceMeters(nearestOriginMetro.lat, nearestOriginMetro.lng, nearestDestMetro.lat, nearestDestMetro.lng);

  const metroWalkAccessMinutes = Math.max(0, Math.round((originToMetroDist / 1000) * 11));
  const metroWalkEgressMinutes = Math.max(0, Math.round((destFromMetroDist / 1000) * 11));
  const metroRideMinutes = Math.max(4, Math.round((metroRideDist / 1000) * 2.2));
  const metroFare = Math.max(6, Math.min(22, 6 + Math.round((metroRideDist / 1000) * 2)));

  const metroWalkToHub: JourneyLeg = {
    id: 'leg-metro-access',
    mode: 'walking',
    from: origin,
    to: nearestOriginMetro,
    distanceMeters: originToMetroDist,
    durationMinutes: metroWalkAccessMinutes,
    cost: 0,
    instructions: origin.id === nearestOriginMetro.id
      ? `Already at ${nearestOriginMetro.name} concourse.`
      : `Walk ${originToMetroDist}m along illuminated city sidewalks into ${nearestOriginMetro.name} Gate 1.`,
    isAccessible: true,
    lightingQuality: 'high',
    weatherResilient: true,
    coordinates: generatePathCoords(origin, nearestOriginMetro, 'walking')
  };

  const metroTransitRide: JourneyLeg = {
    id: 'leg-metro-ride',
    mode: 'metro',
    from: nearestOriginMetro,
    to: nearestDestMetro,
    distanceMeters: Math.round(metroRideDist * 1.1),
    durationMinutes: metroRideMinutes,
    cost: metroFare,
    instructions: `Board Jaipur Metro Pink Line (Line 1 Rapid) from ${nearestOriginMetro.name} towards ${nearestDestMetro.name}. High-speed, AC, level-boarding cars.`,
    lineName: 'Jaipur Metro Pink Line',
    lineColor: '#ec4899', // Jaipur Pink
    isAccessible: true,
    lightingQuality: 'high',
    weatherResilient: true,
    coordinates: generatePathCoords(nearestOriginMetro, nearestDestMetro, 'metro')
  };

  const metroEgressWalk: JourneyLeg = {
    id: 'leg-metro-egress',
    mode: 'walking',
    from: nearestDestMetro,
    to: dest,
    distanceMeters: destFromMetroDist,
    durationMinutes: metroWalkEgressMinutes,
    cost: 0,
    instructions: dest.id === nearestDestMetro.id
      ? `Direct step-free arrival at ${dest.name}.`
      : `Exit ${nearestDestMetro.name} via Station Elevator/Escalator and walk ${destFromMetroDist}m directly to ${dest.name}.`,
    isAccessible: true,
    lightingQuality: 'high',
    weatherResilient: true,
    coordinates: generatePathCoords(nearestDestMetro, dest, 'walking')
  };

  const metroLegs: JourneyLeg[] = [
    ...(metroWalkAccessMinutes > 0 ? [metroWalkToHub] : []),
    metroTransitRide,
    ...(metroWalkEgressMinutes > 0 ? [metroEgressWalk] : [])
  ];

  const metroWaitMinutes = 4;
  const metroTotalTime = metroWalkAccessMinutes + metroRideMinutes + metroWalkEgressMinutes + metroWaitMinutes;
  const metroWalkDist = originToMetroDist + destFromMetroDist;

  const metroOption: RouteOption = {
    id: 'route-metro-express',
    title: 'Jaipur Metro Pink Line Rapid Corridor',
    summary: 'Grade-separated electric rapid transit across central Jaipur',
    categoryTag: 'Fastest Choice',
    totalDurationMinutes: metroTotalTime,
    totalCost: metroFare,
    walkingDistanceMeters: metroWalkDist,
    walkingDurationMinutes: metroWalkAccessMinutes + metroWalkEgressMinutes,
    transfersCount: nearestOriginMetro.id === nearestDestMetro.id ? 0 : 0,
    co2SavedGrams: Math.round((directDistance / 1000) * 125),
    safetyScore: 97,
    accessibilityScore: 98,
    weatherRisk: 'low',
    legs: metroLegs,
    explanation: `Fastest connection utilizing Jaipur Metro Pink Line from ${nearestOriginMetro.name} to ${nearestDestMetro.name}, bypassing road traffic with 5-minute departures.`,
    highlights: ['Zero road traffic delays', '100% weather-sheltered underground & elevated platforms', 'Wheelchair level boarding'],
    warnings: [],
    isDemoData: true
  };
  candidates.push(metroOption);

  // ==========================================
  // CANDIDATE 3: JCTSL MUNICIPAL BUS CORRIDOR (9A / Route 5)
  // ==========================================
  const isJLNCorridor = [origin.id, dest.id].some((id) =>
    ['sms-hospital', 'mnit-campus', 'wtp-malviya-nagar', 'airport-sanganer', 'sitapura-tech-zone', 'statue-circle'].includes(id)
  );

  const busLineName = isJLNCorridor ? 'JCTSL Route 9A (JLN Marg Rapid)' : 'JCTSL Route 5 (CityLink Low-Floor)';
  const busLineColor = isJLNCorridor ? '#0284c7' : '#f59e0b';
  const busFare = isJLNCorridor ? 12 : 10;
  const busRideMinutes = Math.round((directDistance / 1000) * 3.4) + 6;

  const busWalkAccess: JourneyLeg = {
    id: 'leg-bus-access',
    mode: 'walking',
    from: origin,
    to: origin,
    distanceMeters: 140,
    durationMinutes: 2,
    cost: 0,
    instructions: `Walk 140m to closest JCTSL Municipal Bus Shelter on ${origin.address?.split(',')[0] || 'Avenue'}.`,
    isAccessible: true,
    lightingQuality: 'high',
    weatherResilient: false,
    coordinates: generatePathCoords(origin, origin, 'walking')
  };

  const busRide: JourneyLeg = {
    id: 'leg-bus-ride',
    mode: 'bus',
    from: origin,
    to: dest,
    distanceMeters: Math.round(directDistance * 1.18),
    durationMinutes: busRideMinutes,
    cost: busFare,
    instructions: `Board ${busLineName} Low-Floor Bus towards ${dest.name}. Contactless smartcard & digital UPI fare accepted.`,
    lineName: busLineName,
    lineColor: busLineColor,
    isAccessible: true,
    lightingQuality: 'medium',
    weatherResilient: !prefs.weatherAlertActive,
    coordinates: generatePathCoords(origin, dest, 'bus')
  };

  const busWalkEgress: JourneyLeg = {
    id: 'leg-bus-egress',
    mode: 'walking',
    from: dest,
    to: dest,
    distanceMeters: 120,
    durationMinutes: 2,
    cost: 0,
    instructions: `Walk 120m from curbside bus stop directly into ${dest.name}.`,
    isAccessible: true,
    lightingQuality: 'high',
    weatherResilient: false,
    coordinates: generatePathCoords(dest, dest, 'walking')
  };

  const busLegs = [busWalkAccess, busRide, busWalkEgress];
  const busTotalTime = 2 + busRideMinutes + 2 + 5; // +5 mins headway wait
  const busWalkDist = 260;

  const busOption: RouteOption = {
    id: 'route-bus-citylink',
    title: `${busLineName} Direct Corridor`,
    summary: 'High-frequency low-floor municipal public transit',
    categoryTag: 'Cheapest Option',
    totalDurationMinutes: busTotalTime,
    totalCost: busFare,
    walkingDistanceMeters: busWalkDist,
    walkingDurationMinutes: 4,
    transfersCount: 0,
    co2SavedGrams: Math.round((directDistance / 1000) * 92),
    safetyScore: 88,
    accessibilityScore: 90,
    weatherRisk: prefs.weatherAlertActive ? 'moderate' : 'low',
    legs: busLegs,
    explanation: `Affordable municipal transit option (₹${busFare} flat fare) dropping you right on curbside next to ${dest.name}.`,
    highlights: [`Budget-friendly ₹${busFare} fare`, 'Direct curbside stop without deep stairs', 'Low-floor ramp enabled'],
    warnings: prefs.weatherAlertActive ? ['Road surface water on underpass sections may add 6-8 minutes.'] : [],
    isDemoData: true
  };
  candidates.push(busOption);

  // ==========================================
  // CANDIDATE 4: MULTI-MODAL COMBO (FEEDER E-RICKSHAW + METRO PINK LINE)
  // ==========================================
  const centralHub = getLocationById('sindhi-camp') || nearestOriginMetro;
  const feederDist = calculateDistanceMeters(origin.lat, origin.lng, centralHub.lat, centralHub.lng);
  const feederMinutes = Math.max(4, Math.round((feederDist / 1000) * 3.5));

  const feederBusRide: JourneyLeg = {
    id: 'leg-feeder-ride',
    mode: 'bus',
    from: origin,
    to: centralHub,
    distanceMeters: feederDist,
    durationMinutes: feederMinutes,
    cost: 10,
    instructions: `Board Feeder E-Rickshaw / Mini-Bus to ${centralHub.name}.`,
    lineName: 'Jaipur Smart Feeder',
    lineColor: '#f59e0b',
    isAccessible: true,
    lightingQuality: 'high',
    weatherResilient: true,
    coordinates: generatePathCoords(origin, centralHub, 'bus')
  };

  const transferWalk: JourneyLeg = {
    id: 'leg-transfer-walk',
    mode: 'walking',
    from: centralHub,
    to: centralHub,
    distanceMeters: 75,
    durationMinutes: 2,
    cost: 0,
    instructions: `Walk 75m via indoor concourse directly to Jaipur Metro Pink Line Platform.`,
    isAccessible: true,
    lightingQuality: 'high',
    weatherResilient: true,
    coordinates: generatePathCoords(centralHub, centralHub, 'walking')
  };

  const metroPinkRide: JourneyLeg = {
    id: 'leg-metro-m2-ride',
    mode: 'metro',
    from: centralHub,
    to: nearestDestMetro,
    distanceMeters: calculateDistanceMeters(centralHub.lat, centralHub.lng, nearestDestMetro.lat, nearestDestMetro.lng),
    durationMinutes: Math.max(5, Math.round((calculateDistanceMeters(centralHub.lat, centralHub.lng, nearestDestMetro.lat, nearestDestMetro.lng) / 1000) * 2.2)),
    cost: 12,
    instructions: `Board Jaipur Metro Pink Line towards ${nearestDestMetro.name}.`,
    lineName: 'Jaipur Metro Pink Line',
    lineColor: '#ec4899',
    isAccessible: true,
    lightingQuality: 'high',
    weatherResilient: true,
    coordinates: generatePathCoords(centralHub, nearestDestMetro, 'metro')
  };

  const comboLegs = [feederBusRide, transferWalk, metroPinkRide, metroEgressWalk];
  const comboTotalTime = feederMinutes + 2 + metroPinkRide.durationMinutes + metroWalkEgressMinutes + 3;
  const comboTotalCost = 10 + 12;

  const comboOption: RouteOption = {
    id: 'route-combo-interchange',
    title: 'Smart Feeder Shuttle + Metro Link',
    summary: `Seamless multi-modal connection via ${centralHub.name}`,
    categoryTag: 'Balanced Flow',
    totalDurationMinutes: comboTotalTime,
    totalCost: comboTotalCost,
    walkingDistanceMeters: 75 + destFromMetroDist,
    walkingDurationMinutes: 2 + metroWalkEgressMinutes,
    transfersCount: 1,
    co2SavedGrams: Math.round((directDistance / 1000) * 115),
    safetyScore: 95,
    accessibilityScore: 96,
    weatherRisk: 'low',
    legs: comboLegs,
    explanation: `Combines first-mile feeder mobility with congestion-free Jaipur Metro transit through ${centralHub.name}.`,
    highlights: ['Low walking effort', 'Protected indoor interchange', 'Fast transfer turnaround'],
    warnings: [],
    isDemoData: true
  };
  candidates.push(comboOption);

  // ==========================================
  // CANDIDATE 5: JAL MAHAL / AMER SCENIC ROUTE (DISRUPTION DEMO)
  // ==========================================
  const jalMahalStop = getLocationById('jal-mahal')!;
  const isJalMahalDisrupted = disruptedStopIds.includes('jal-mahal') || prefs.avoidFloodedAreas || prefs.weatherAlertActive;

  const jalMahalBusDist = calculateDistanceMeters(origin.lat, origin.lng, jalMahalStop.lat, jalMahalStop.lng);
  const jalMahalEgressDist = calculateDistanceMeters(jalMahalStop.lat, jalMahalStop.lng, dest.lat, dest.lng);
  const jalMahalBusMinutes = isJalMahalDisrupted
    ? Math.max(30, Math.round((jalMahalBusDist / 1000) * 5) + 20)
    : Math.max(12, Math.round((jalMahalBusDist / 1000) * 3));
  const jalMahalEgressMinutes = isJalMahalDisrupted
    ? Math.max(14, Math.round((jalMahalEgressDist / 1000) * 16))
    : Math.max(5, Math.round((jalMahalEgressDist / 1000) * 11));

  const jalMahalBusLeg: JourneyLeg = {
    id: 'leg-river-bus',
    mode: 'bus',
    from: origin,
    to: jalMahalStop,
    distanceMeters: jalMahalBusDist,
    durationMinutes: jalMahalBusMinutes,
    cost: 12,
    instructions: isJalMahalDisrupted
      ? 'CAUTION: JCTSL Route 7 diverted around 35cm standing water near Jal Mahal Amer Road underpass.'
      : 'Board JCTSL Route 7 (Heritage Amer & Waterfront Shuttle) along scenic Man Sagar lake promenade.',
    lineName: 'JCTSL Route 7 (Amer Shuttle)',
    lineColor: '#8b5cf6',
    isAccessible: false,
    lightingQuality: 'medium',
    weatherResilient: false,
    coordinates: generatePathCoords(origin, jalMahalStop, 'bus')
  };

  const jalMahalWalkConnect: JourneyLeg = {
    id: 'leg-river-walk',
    mode: 'walking',
    from: jalMahalStop,
    to: dest,
    distanceMeters: jalMahalEgressDist,
    durationMinutes: jalMahalEgressMinutes,
    cost: 0,
    instructions: isJalMahalDisrupted
      ? `Pedestrian detour required around lake embankment due to surface runoff to reach ${dest.name}.`
      : `Walk along Man Sagar promenade directly to ${dest.name}.`,
    isAccessible: false,
    lightingQuality: 'medium',
    weatherResilient: false,
    coordinates: generatePathCoords(jalMahalStop, dest, 'walking')
  };

  const jalMahalRoute: RouteOption = {
    id: 'route-riverway-scenic',
    title: 'JCTSL Route 7 Jal Mahal Waterfront Promenade',
    summary: 'Heritage lakeside corridor along Amer Road & Man Sagar lake',
    categoryTag: isJalMahalDisrupted ? 'Disrupted / Diverted' : 'Heritage Scenic',
    totalDurationMinutes: jalMahalBusMinutes + jalMahalEgressMinutes + 4,
    totalCost: 12,
    walkingDistanceMeters: jalMahalEgressDist,
    walkingDurationMinutes: jalMahalEgressMinutes,
    transfersCount: 0,
    co2SavedGrams: 80,
    safetyScore: isJalMahalDisrupted ? 46 : 74,
    accessibilityScore: 55,
    weatherRisk: isJalMahalDisrupted ? 'high' : 'moderate',
    legs: [jalMahalBusLeg, jalMahalWalkConnect],
    explanation: isJalMahalDisrupted
      ? 'CRITICAL ALERT: Jal Mahal Amer Road Underpass has 35cm water accumulation from Aravalli monsoon runoff. Journey delayed by 38 mins.'
      : 'Scenic heritage lakeside route along Man Sagar lake with views of Jal Mahal.',
    highlights: ['Scenic heritage lakeside views'],
    warnings: isJalMahalDisrupted
      ? ['35cm standing rainwater reported at Jal Mahal Amer Road Underpass.', 'Wheelchair access not available on this heritage bus variant.']
      : ['Street lighting near lake promenade is moderate after 21:00.'],
    isDemoData: true
  };
  candidates.push(jalMahalRoute);

  // ==========================================
  // RANKING & FILTERING
  // ==========================================
  return rankCandidateRoutes(candidates, prefs, isJalMahalDisrupted);
}

function rankCandidateRoutes(
  candidates: RouteOption[],
  prefs: UserPreferences,
  isJalMahalDisrupted: boolean
): RouteOption[] {
  let filtered = [...candidates];

  if (prefs.maxBudget > 0) {
    filtered.forEach((r) => {
      if (r.totalCost > prefs.maxBudget) {
        r.warnings.push(`Exceeds your budget limit of ₹${prefs.maxBudget} by ₹${r.totalCost - prefs.maxBudget}.`);
      }
    });
  }

  if (prefs.maxWalkingDistanceMeters > 0) {
    filtered.forEach((r) => {
      if (r.walkingDistanceMeters > prefs.maxWalkingDistanceMeters) {
        r.warnings.push(`Walking distance (${r.walkingDistanceMeters}m) exceeds preferred cap of ${prefs.maxWalkingDistanceMeters}m.`);
      }
    });
  }

  filtered.sort((a, b) => {
    switch (prefs.comparisonMode) {
      case 'fastest':
        return a.totalDurationMinutes - b.totalDurationMinutes;

      case 'cheapest':
        return a.totalCost - b.totalCost || a.totalDurationMinutes - b.totalDurationMinutes;

      case 'safety-conscious':
        return b.safetyScore - a.safetyScore || a.totalDurationMinutes - b.totalDurationMinutes;

      case 'family-friendly': {
        const scoreA = a.transfersCount * 20 + (a.walkingDistanceMeters / 100) * 2 - a.accessibilityScore * 0.3;
        const scoreB = b.transfersCount * 20 + (b.walkingDistanceMeters / 100) * 2 - b.accessibilityScore * 0.3;
        return scoreA - scoreB;
      }

      case 'min-walk':
        return a.walkingDistanceMeters - b.walkingDistanceMeters || a.totalDurationMinutes - b.totalDurationMinutes;

      case 'accessible':
        return b.accessibilityScore - a.accessibilityScore || a.totalDurationMinutes - b.totalDurationMinutes;

      case 'weather-aware': {
        const riskPenaltyA = a.weatherRisk === 'high' ? 100 : a.weatherRisk === 'moderate' ? 30 : 0;
        const riskPenaltyB = b.weatherRisk === 'high' ? 100 : b.weatherRisk === 'moderate' ? 30 : 0;
        return (a.totalDurationMinutes + riskPenaltyA) - (b.totalDurationMinutes + riskPenaltyB);
      }

      case 'balanced':
      default: {
        const costNormA = a.totalCost / 30;
        const timeNormA = a.totalDurationMinutes / 40;
        const walkNormA = a.walkingDistanceMeters / 1000;
        const penaltyA = (a.weatherRisk === 'high' ? 2 : 0) + (isJalMahalDisrupted && a.id.includes('river') ? 3 : 0);

        const costNormB = b.totalCost / 30;
        const timeNormB = b.totalDurationMinutes / 40;
        const walkNormB = b.walkingDistanceMeters / 1000;
        const penaltyB = (b.weatherRisk === 'high' ? 2 : 0) + (isJalMahalDisrupted && b.id.includes('river') ? 3 : 0);

        return (costNormA + timeNormA + walkNormA + penaltyA) - (costNormB + timeNormB + walkNormB + penaltyB);
      }
    }
  });

  return filtered;
}
