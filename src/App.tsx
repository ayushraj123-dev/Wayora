/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { METRO_LOCATIONS, INITIAL_DISRUPTIONS } from './data/transitNetwork';
import { UserPreferences, RouteOption, ComparisonMode, DisruptionReport } from './types';
import { generateCandidateRoutes, getLocationById } from './services/routingEngine';
import { ThreeHeroCanvas } from './components/ThreeHeroCanvas';
import { ThreeJourneyVisualizer } from './components/ThreeJourneyVisualizer';
import { ThreeBrandLogo } from './components/ThreeBrandLogo';
import { InteractiveMap } from './components/InteractiveMap';
import { RouteComparison } from './components/RouteComparison';
import { AuraAssistant } from './components/AuraAssistant';
import { DisruptionManager } from './components/DisruptionManager';
import { EmergencyModal } from './components/EmergencyModal';
import { SettingsModal } from './components/SettingsModal';

import {
  Navigation,
  MapPin,
  Clock,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Settings,
  HeartPulse,
  CloudRain,
  Compass,
  Layers,
  Bot,
  Zap,
  ChevronRight,
  CheckCircle2,
  TrendingDown
} from 'lucide-react';

export default function App() {
  // Application View Mode: 'landing' (3D Hero) or 'planner' (Interactive Journey Hub)
  const [viewState, setViewState] = useState<'landing' | 'planner'>('landing');
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'disruptions' | 'aura'>('overview');

  // Preferences State
  const [preferences, setPreferences] = useState<UserPreferences>({
    originId: 'jaipur-junction',
    destinationId: 'sms-hospital',
    departureTime: 'Now',
    comparisonMode: 'fastest',
    maxBudget: 60,
    maxWalkingDistanceMeters: 800,
    requireWheelchairAccess: false,
    requireElevators: false,
    preferWellLit: true,
    minimizeTransfers: false,
    avoidFloodedAreas: false,
    weatherAlertActive: false
  });

  // Disruptions State
  const [disruptions, setDisruptions] = useState<DisruptionReport[]>(INITIAL_DISRUPTIONS);

  // Modals
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showRecalculateToast, setShowRecalculateToast] = useState(false);

  // Derive origin and destination objects
  const originLocation = useMemo(
    () => getLocationById(preferences.originId) || METRO_LOCATIONS[0],
    [preferences.originId]
  );
  const destinationLocation = useMemo(
    () => getLocationById(preferences.destinationId) || METRO_LOCATIONS[1],
    [preferences.destinationId]
  );

  // Calculate Routes
  const candidateRoutes = useMemo(() => {
    const floodedStops = disruptions
      .filter((d) => d.status === 'verified' && d.category === 'flooding')
      .map((d) => (d.locationName.includes('Jal Mahal') || d.locationName.includes('River') ? 'jal-mahal' : ''));
    return generateCandidateRoutes(preferences, floodedStops);
  }, [preferences, disruptions]);

  // Selected Active Route
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-metro-express');

  const selectedRoute = useMemo(() => {
    return (
      candidateRoutes.find((r) => r.id === selectedRouteId) ||
      candidateRoutes[0] || {
        id: 'fallback-none',
        title: 'Direct Multi-Modal Journey',
        summary: 'Synchronizing multi-modal legs...',
        categoryTag: 'Standard',
        totalDurationMinutes: 18,
        totalCost: 15,
        walkingDistanceMeters: 300,
        walkingDurationMinutes: 4,
        transfersCount: 0,
        co2SavedGrams: 90,
        safetyScore: 90,
        accessibilityScore: 95,
        weatherRisk: 'low',
        legs: [],
        explanation: 'Direct connection available.',
        highlights: [],
        warnings: [],
        isDemoData: true
      }
    );
  }, [candidateRoutes, selectedRouteId]);

  // Synchronize selection when candidate routes change
  useEffect(() => {
    if (candidateRoutes.length > 0 && !candidateRoutes.some((r) => r.id === selectedRouteId)) {
      setSelectedRouteId(candidateRoutes[0].id);
    }
  }, [candidateRoutes, selectedRouteId]);

  // Handler for partial preferences updates from UI or Aura
  const handleUpdatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
    if (updates.comparisonMode) {
      // Auto-trigger smooth notification
      setShowRecalculateToast(true);
      setTimeout(() => setShowRecalculateToast(false), 2500);
    }
  };

  // 1-Click Demo Journey Flow
  const handleRunDemoJourney = () => {
    setPreferences({
      originId: 'jaipur-junction',
      destinationId: 'sms-hospital',
      departureTime: 'Now (Peak)',
      comparisonMode: 'fastest',
      maxBudget: 40,
      maxWalkingDistanceMeters: 500,
      requireWheelchairAccess: true,
      requireElevators: true,
      preferWellLit: true,
      minimizeTransfers: true,
      avoidFloodedAreas: true,
      weatherAlertActive: false
    });
    setViewState('planner');
    setActiveTab('overview');
  };

  // Toggle Weather Monsoon Storm
  const handleToggleWeatherSimulation = () => {
    const nextState = !preferences.weatherAlertActive;
    handleUpdatePreferences({
      weatherAlertActive: nextState,
      avoidFloodedAreas: nextState,
      comparisonMode: nextState ? 'weather-aware' : 'fastest'
    });
    setShowRecalculateToast(true);
    setTimeout(() => setShowRecalculateToast(false), 3000);
  };

  // Recalculate from Missed Transfer
  const handleTriggerMissedTransfer = () => {
    // Shifts departure time and forces recalculation with feeder bus & metro
    handleUpdatePreferences({
      departureTime: '+6 min departure',
      comparisonMode: 'fastest'
    });
    setShowRecalculateToast(true);
    setTimeout(() => setShowRecalculateToast(false), 3000);
  };

  // Handle adding new disruption
  const handleAddDisruption = (newDisruption: DisruptionReport) => {
    setDisruptions((prev) => [newDisruption, ...prev]);
    if (newDisruption.category === 'flooding') {
      handleUpdatePreferences({
        weatherAlertActive: true,
        avoidFloodedAreas: true,
        comparisonMode: 'weather-aware'
      });
    }
  };

  const handleUpvoteDisruption = (id: string) => {
    setDisruptions((prev) =>
      prev.map((d) => (d.id === id ? { ...d, upvotes: d.upvotes + 1, status: 'verified' } : d))
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* ========================================================= */}
      {/* TOP NAVIGATION BAR                                         */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Mark */}
          <div
            onClick={() => setViewState('landing')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <ThreeBrandLogo size={36} className="shadow-lg shadow-cyan-500/20" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-white group-hover:text-cyan-400 transition">
                  WAYORA
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  v3.8 3D Flow
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block tracking-wide uppercase font-mono">
                Way + Aura • Intelligent Mobility
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs (when in planner view) */}
          {viewState === 'planner' && (
            <div className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shadow-inner">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'overview'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3D Corridor & Map
              </button>
              <button
                onClick={() => setActiveTab('comparison')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'comparison'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Compare Alternatives ({candidateRoutes.length})
              </button>
              <button
                onClick={() => setActiveTab('disruptions')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'disruptions'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Disruptions</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </button>
              <button
                onClick={() => setActiveTab('aura')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'aura'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
                <span>Aura AI</span>
              </button>
            </div>
          )}

          {/* Right Action Utilities */}
          <div className="flex items-center gap-2">
            {/* Weather status indicator */}
            <button
              onClick={handleToggleWeatherSimulation}
              className={`p-2 rounded-xl text-xs flex items-center gap-1.5 transition border ${
                preferences.weatherAlertActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/20 animate-pulse'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
              title="Toggle Simulated Storm / Flood Scenario"
            >
              <CloudRain className="w-4 h-4 text-cyan-400" />
              <span className="hidden lg:inline text-[11px] font-semibold">
                {preferences.weatherAlertActive ? 'Storm Reroute' : 'Weather: Clear'}
              </span>
            </button>

            {/* Emergency Hospital 1-Click Priority */}
            <button
              onClick={() => setIsEmergencyOpen(true)}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition flex items-center gap-1.5"
              title="Emergency Travel Priority Assistance"
            >
              <HeartPulse className="w-4 h-4 animate-pulse" />
              <span className="hidden sm:inline text-xs font-bold">Emergency</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
              title="Routing Preferences and Accessibility Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Switch between Hero Landing & Planner */}
            {viewState === 'landing' ? (
              <button
                onClick={() => setViewState('planner')}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center gap-1"
              >
                <span>Open Planner</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setViewState('landing')}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition"
              >
                3D Hero
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Recalculate Toast Alert */}
      {showRecalculateToast && (
        <div className="fixed top-16 right-6 z-50 p-3 rounded-2xl bg-cyan-900/90 backdrop-blur-md border border-cyan-400/50 text-white text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Zap className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>Multi-modal routing graph updated: {preferences.comparisonMode.toUpperCase()} mode applied!</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* MAIN CONTENT AREA                                         */}
      {/* ========================================================= */}
      <main className="flex-1">
        {viewState === 'landing' ? (
          /* ========================================== */
          /* SCREEN 1: 3D INTERACTIVE HERO LANDING PAGE */
          /* ========================================== */
          <div className="relative min-h-[calc(100vh-64px)] overflow-hidden flex flex-col justify-between">
            {/* 3D WebGL Canvas Layer */}
            <ThreeHeroCanvas />

            {/* Hero Foreground Overlay */}
            <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 lg:py-16 flex-1 flex flex-col justify-center">
              <div className="max-w-3xl space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold backdrop-blur-md">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Problem Statement 7 • Multi-Modal Journey Intelligence</span>
                </div>

                <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
                  Every Route Has a <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">Better Way.</span>
                </h1>

                <p className="text-base sm:text-lg text-slate-300 font-light leading-relaxed max-w-2xl">
                  Meet <strong className="text-white font-semibold">WAYORA</strong> — where finding your best way meets the intelligent awareness of Aura. Seamlessly connecting walking, JCTSL low-floor buses, and the Jaipur Metro Pink Line into personalised, disruption-resilient journeys across the Pink City.
                </p>

                {/* Instant Journey Origin/Dest Search Widget */}
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/85 backdrop-blur-xl border border-slate-700/80 shadow-2xl space-y-4 max-w-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Origin */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Origin Location
                      </label>
                      <select
                        value={preferences.originId}
                        onChange={(e) => handleUpdatePreferences({ originId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-cyan-500 focus:outline-none"
                      >
                        {METRO_LOCATIONS.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Destination */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Navigation className="w-3.5 h-3.5 text-red-400" /> Destination
                      </label>
                      <select
                        value={preferences.destinationId}
                        onChange={(e) => handleUpdatePreferences({ destinationId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-cyan-500 focus:outline-none"
                      >
                        {METRO_LOCATIONS.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Departure: <strong className="text-white">Now (Synchronized GTFS)</strong></span>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      <button
                        onClick={handleRunDemoJourney}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                      >
                        Try Demo Journey
                      </button>
                      <button
                        onClick={() => setViewState('planner')}
                        className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-xl shadow-cyan-500/30 flex items-center justify-center gap-1.5"
                      >
                        <span>Plan My Journey</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Highlights row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80">
                    <div className="text-cyan-400 font-extrabold text-lg">Multi-Modal</div>
                    <div className="text-slate-400 text-[11px]">Walk, Metro, Bus & Micro-Mobility</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80">
                    <div className="text-emerald-400 font-extrabold text-lg">Safe Corridors</div>
                    <div className="text-slate-400 text-[11px]">Municipal Lighting & Footfall Scoring</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80">
                    <div className="text-amber-400 font-extrabold text-lg">Flood Resilient</div>
                    <div className="text-slate-400 text-[11px]">Real-time Rerouting Around Water</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80">
                    <div className="text-indigo-400 font-extrabold text-lg">Aura Voice</div>
                    <div className="text-slate-400 text-[11px]">Natural Speech & AI Co-Pilot</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Brand Bar */}
            <div className="relative z-10 bg-slate-950/80 border-t border-slate-900 px-6 py-3 text-center text-xs text-slate-500">
              Move Smarter. Feel the Journey. — Jaipur Multi-Modal Transit Intelligence with Jaipur Metro Pink Line, JCTSL low-floor buses, and live resilience.
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* SCREEN 2: DYNAMIC SPLIT JOURNEY PLANNER & INTERACTIVE MAP */
          /* ========================================================= */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Top Route Parameter Strip */}
            <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Origin Selector */}
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-400">From:</span>
                  <select
                    value={preferences.originId}
                    onChange={(e) => handleUpdatePreferences({ originId: e.target.value })}
                    className="bg-transparent text-white font-semibold focus:outline-none"
                  >
                    {METRO_LOCATIONS.map((loc) => (
                      <option key={loc.id} value={loc.id} className="bg-slate-900">
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-500 hidden sm:block" />

                {/* Destination Selector */}
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <Navigation className="w-4 h-4 text-red-400" />
                  <span className="text-slate-400">To:</span>
                  <select
                    value={preferences.destinationId}
                    onChange={(e) => handleUpdatePreferences({ destinationId: e.target.value })}
                    className="bg-transparent text-white font-semibold focus:outline-none"
                  >
                    {METRO_LOCATIONS.map((loc) => (
                      <option key={loc.id} value={loc.id} className="bg-slate-900">
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time */}
                <div className="hidden lg:flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Departs: <strong className="text-white">{preferences.departureTime}</strong></span>
                </div>
              </div>

              {/* Mode Badges & Quick Stats */}
              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                  {candidateRoutes.length} Feasible Options
                </span>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold transition"
                >
                  Adjust Budget / Walk
                </button>
              </div>
            </div>

            {/* Split Main View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT 7 COLS: 3D Layered Visualizer + Interactive Leaflet Map */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. MANDATORY 3D JOURNEY VISUALIZER */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        <span>3D Spatial Multi-Modal Corridor</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold">
                        WebGL Multi-Tier
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-[11px] font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Free 3D Orbit • Drag & Zoom</span>
                    </div>
                  </div>
                  <ThreeJourneyVisualizer route={selectedRoute} />
                </div>

                {/* 2. INTERACTIVE GEOGRAPHIC TRANSIT MAP */}
                <div className="space-y-2.5 bg-slate-900/60 p-3 sm:p-4 rounded-3xl border border-slate-800/80 shadow-2xl backdrop-blur-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                      <Compass className="w-4 h-4 text-cyan-400" />
                      <span>Jaipur CARTO Transit GIS Map</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Road & Metro Line Snapped
                      </span>
                      <span className="text-slate-400 font-mono text-[11px] hidden sm:inline-block">
                        CARTO Voyager GIS
                      </span>
                    </div>
                  </div>
                  <InteractiveMap
                    routes={candidateRoutes}
                    selectedRoute={selectedRoute}
                    onSelectRoute={(r) => setSelectedRouteId(r.id)}
                    disruptions={disruptions}
                    originLocation={originLocation}
                    destinationLocation={destinationLocation}
                    onSelectOrigin={(loc) => handleUpdatePreferences({ originId: loc.id })}
                    onSelectDestination={(loc) => handleUpdatePreferences({ destinationId: loc.id })}
                  />
                </div>
              </div>

              {/* RIGHT 5 COLS: Tabs (Route Comparison, Disruptions, or Aura Assistant) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Mobile / Tablet Tab switchers */}
                <div className="flex md:hidden items-center justify-around bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                      activeTab === 'overview' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Routes
                  </button>
                  <button
                    onClick={() => setActiveTab('comparison')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                      activeTab === 'comparison' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Compare
                  </button>
                  <button
                    onClick={() => setActiveTab('disruptions')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                      activeTab === 'disruptions' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Disruptions
                  </button>
                  <button
                    onClick={() => setActiveTab('aura')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                      activeTab === 'aura' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Aura AI
                  </button>
                </div>

                {/* Tab 1: Route Comparison Cards */}
                {(activeTab === 'overview' || activeTab === 'comparison') && (
                  <RouteComparison
                    routes={candidateRoutes}
                    selectedRoute={selectedRoute}
                    onSelectRoute={(r) => setSelectedRouteId(r.id)}
                    activeMode={preferences.comparisonMode}
                    onChangeMode={(m) => handleUpdatePreferences({ comparisonMode: m })}
                    preferences={preferences}
                  />
                )}

                {/* Tab 2: Disruption Reporting & Resilience */}
                {activeTab === 'disruptions' && (
                  <DisruptionManager
                    disruptions={disruptions}
                    onAddDisruption={handleAddDisruption}
                    onUpvoteDisruption={handleUpvoteDisruption}
                    onTriggerWeatherSimulation={handleToggleWeatherSimulation}
                    onTriggerMissedTransfer={handleTriggerMissedTransfer}
                    weatherActive={preferences.weatherAlertActive}
                  />
                )}

                {/* Tab 3: Dedicated Aura Voice & Text Assistant */}
                {activeTab === 'aura' && (
                  <div className="h-[620px]">
                    <AuraAssistant
                      onApplyPreferences={handleUpdatePreferences}
                      onTriggerRecalculation={handleTriggerMissedTransfer}
                      currentPreferences={preferences}
                      selectedRouteTitle={selectedRoute.title}
                    />
                  </div>
                )}

                {/* If on Overview tab, show compact Aura Assistant box underneath */}
                {activeTab === 'overview' && (
                  <div className="pt-2 h-96">
                    <AuraAssistant
                      onApplyPreferences={handleUpdatePreferences}
                      onTriggerRecalculation={handleTriggerMissedTransfer}
                      currentPreferences={preferences}
                      selectedRouteTitle={selectedRoute.title}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODALS                                                    */}
      {/* ========================================================= */}
      <EmergencyModal
        isOpen={isEmergencyOpen}
        onClose={() => setIsEmergencyOpen(false)}
        onRouteToHospital={() => {
          handleUpdatePreferences({
            destinationId: 'sms-hospital',
            comparisonMode: 'fastest'
          });
          setViewState('planner');
          setActiveTab('overview');
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
      />
    </div>
  );
}
