/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransportMode = 'walking' | 'bus' | 'metro' | 'micro-mobility';

export type ComparisonMode = 
  | 'fastest'
  | 'cheapest'
  | 'safety-conscious'
  | 'family-friendly'
  | 'min-walk'
  | 'accessible'
  | 'weather-aware'
  | 'balanced';

export interface GeoLocation {
  id: string;
  name: string;
  category: 'station' | 'metro-station' | 'bus-stop' | 'landmark' | 'residential' | 'hospital' | 'commercial';
  lat: number;
  lng: number;
  address?: string;
  lightingScore?: number; // 0 to 100
  hasElevator?: boolean;
  isWheelchairAccessible?: boolean;
}

export interface TransitLine {
  id: string;
  name: string;
  shortName: string;
  mode: TransportMode;
  color: string;
  frequencyMinutes: number;
  baseFare: number;
  farePerKm: number;
  isAccessible: boolean;
  stops: string[]; // GeoLocation IDs in sequence
}

export interface JourneyLeg {
  id: string;
  mode: TransportMode;
  from: GeoLocation;
  to: GeoLocation;
  distanceMeters: number;
  durationMinutes: number;
  cost: number;
  instructions: string;
  lineName?: string;
  lineColor?: string;
  isAccessible: boolean;
  lightingQuality: 'high' | 'medium' | 'low';
  weatherResilient: boolean;
  coordinates: [number, number][]; // [lat, lng] array
}

export interface RouteOption {
  id: string;
  title: string;
  summary: string;
  categoryTag: string;
  totalDurationMinutes: number;
  totalCost: number;
  walkingDistanceMeters: number;
  walkingDurationMinutes: number;
  transfersCount: number;
  co2SavedGrams: number; // vs average single-occupancy car
  safetyScore: number; // 0-100 based on verified municipal lighting & high-footfall corridors
  accessibilityScore: number; // 0-100
  weatherRisk: 'low' | 'moderate' | 'high';
  legs: JourneyLeg[];
  explanation: string;
  highlights: string[];
  warnings: string[];
  isDemoData: boolean;
}

export interface UserPreferences {
  originId: string;
  destinationId: string;
  departureTime: string;
  comparisonMode: ComparisonMode;
  maxBudget: number; // in currency units
  maxWalkingDistanceMeters: number;
  requireWheelchairAccess: boolean;
  requireElevators: boolean;
  preferWellLit: boolean;
  minimizeTransfers: boolean;
  avoidFloodedAreas: boolean;
  weatherAlertActive: boolean;
}

export interface DisruptionReport {
  id: string;
  title: string;
  category: 'flooding' | 'road-closure' | 'elevator-outage' | 'crowding' | 'transit-delay';
  severity: 'minor' | 'moderate' | 'critical';
  locationName: string;
  lat: number;
  lng: number;
  description: string;
  reportedAt: string;
  upvotes: number;
  status: 'submitted' | 'corroborated' | 'verified' | 'resolved';
  affectedRoutes: string[];
}

export interface AuraMessage {
  id: string;
  sender: 'user' | 'aura';
  text: string;
  timestamp: string;
  suggestedAction?: {
    type: 'apply-route' | 'change-mode' | 'reroute-flood' | 'recalculate-missed' | 'call-emergency';
    label: string;
    payload?: any;
  };
}
