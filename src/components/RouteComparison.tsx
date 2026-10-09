/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { RouteOption, ComparisonMode, UserPreferences } from '../types';
import { 
  Clock, 
  DollarSign, 
  Footprints, 
  ArrowRightLeft, 
  ShieldCheck, 
  Accessibility, 
  CloudRain, 
  Leaf, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  MapPin,
  Share2,
  Bookmark
} from 'lucide-react';

interface RouteComparisonProps {
  routes: RouteOption[];
  selectedRoute: RouteOption;
  onSelectRoute: (route: RouteOption) => void;
  activeMode: ComparisonMode;
  onChangeMode: (mode: ComparisonMode) => void;
  preferences: UserPreferences;
  onSaveRoute?: (route: RouteOption) => void;
  savedRouteIds?: string[];
}

export const RouteComparison: React.FC<RouteComparisonProps> = ({
  routes,
  selectedRoute,
  onSelectRoute,
  activeMode,
  onChangeMode,
  preferences,
  onSaveRoute,
  savedRouteIds = []
}) => {
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(selectedRoute.id);
  const [shareToast, setShareToast] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollOffset = direction === 'left' ? -220 : 220;
      scrollContainerRef.current.scrollBy({ left: scrollOffset, behavior: 'smooth' });
    }
  };

  const modesList: { key: ComparisonMode; label: string; icon: string }[] = [
    { key: 'fastest', label: 'Fastest', icon: '⚡' },
    { key: 'cheapest', label: 'Cheapest', icon: '💰' },
    { key: 'safety-conscious', label: 'Safe Night Walk', icon: '🛡️' },
    { key: 'family-friendly', label: 'Family Friendly', icon: '👨‍👩‍👧' },
    { key: 'min-walk', label: 'Low Walking', icon: '🚶' },
    { key: 'accessible', label: 'Step-Free Access', icon: '♿' },
    { key: 'weather-aware', label: 'Weather Resilient', icon: '🌧️' },
    { key: 'balanced', label: 'Balanced Flow', icon: '⚖️' }
  ];

  const handleShareJourney = (route: RouteOption) => {
    if (navigator.share) {
      navigator.share({
        title: `WAYORA Journey: ${route.title}`,
        text: `Traveling via ${route.title} (${route.totalDurationMinutes} mins, ₹${route.totalCost}). Tracking live route!`,
        url: window.location.href
      }).catch(() => {});
    } else {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Filter Selector Chips with Left / Right Scroll Controls */}
      <div className="relative flex items-center gap-1.5 bg-slate-950/70 p-1.5 rounded-2xl border border-slate-800 shadow-md">
        <button
          type="button"
          onClick={() => handleScroll('left')}
          className="shrink-0 p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 shadow-sm transition active:scale-95"
          aria-label="Scroll left"
          title="Scroll Left"
        >
          <ChevronLeft className="w-4 h-4 text-cyan-400" />
        </button>

        <div
          ref={scrollContainerRef}
          className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1 scroll-smooth overscroll-x-contain"
        >
          {modesList.map((m) => (
            <button
              key={m.key}
              onClick={() => onChangeMode(m.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                activeMode === m.key
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20 font-bold'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => handleScroll('right')}
          className="shrink-0 p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 shadow-sm transition active:scale-95"
          aria-label="Scroll right"
          title="Scroll Right"
        >
          <ChevronRight className="w-4 h-4 text-cyan-400" />
        </button>
      </div>

      {/* Share Toast */}
      {shareToast && (
        <div className="p-2.5 rounded-xl bg-cyan-900/80 border border-cyan-400/40 text-cyan-200 text-xs flex items-center justify-between">
          <span>✓ Journey details copied to clipboard with trusted contact check-in link!</span>
        </div>
      )}

      {/* Route Cards List */}
      <div className="space-y-3">
        {routes.map((route, index) => {
          const isSelected = route.id === selectedRoute.id;
          const isExpanded = expandedRouteId === route.id;

          return (
            <div
              key={route.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isSelected
                  ? 'bg-slate-900/90 border-cyan-500 shadow-xl shadow-cyan-950/40 ring-1 ring-cyan-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header & Summary */}
              <div
                onClick={() => {
                  onSelectRoute(route);
                  setExpandedRouteId(isExpanded ? null : route.id);
                }}
                className="p-4 cursor-pointer select-none space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-md font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        {route.categoryTag}
                      </span>
                      {index === 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Recommended
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-white tracking-tight">{route.title}</h4>
                    <p className="text-xs text-slate-400">{route.summary}</p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-cyan-400 font-mono">
                        {route.totalDurationMinutes} <span className="text-xs text-slate-400 font-normal">min</span>
                      </div>
                      <div className="text-sm font-semibold text-emerald-400 font-mono">
                        ₹{route.totalCost}
                      </div>
                    </div>

                    {onSaveRoute && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSaveRoute(route);
                        }}
                        className={`p-2 rounded-xl border transition ${
                          savedRouteIds.includes(route.id)
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-white hover:bg-slate-700'
                        }`}
                        title={savedRouteIds.includes(route.id) ? "Saved to your profile" : "Bookmark this route to profile"}
                      >
                        <Bookmark className={`w-4 h-4 ${savedRouteIds.includes(route.id) ? 'fill-current text-cyan-400' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Footprints className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{route.walkingDistanceMeters}m walk</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{route.transfersCount === 0 ? 'Direct' : `${route.transfersCount} transfer`}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{route.safetyScore}% safe</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Leaf className="w-3.5 h-3.5 text-teal-400" />
                    <span>{route.co2SavedGrams}g CO₂ saved</span>
                  </div>
                </div>

                {/* Warnings / Disruption notices if any */}
                {route.warnings.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                    {route.warnings.map((w, wIdx) => (
                      <div key={wIdx} className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Collapsible Step-by-Step Chronological Timeline */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-950/40 space-y-4">
                  {/* Recommendation Explanation */}
                  <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-300 mb-1">
                      <Info className="w-3.5 h-3.5" />
                      <span>Why this route ranks high:</span>
                    </div>
                    <p>{route.explanation}</p>
                  </div>

                  {/* Leg by Leg Journey Timeline */}
                  <div className="space-y-3 relative pl-4 border-l-2 border-slate-700/60 ml-2">
                    {route.legs.map((leg, legIdx) => (
                      <div key={leg.id} className="relative space-y-1 text-xs">
                        {/* Timeline Node Bullet */}
                        <div
                          className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                            leg.mode === 'metro'
                              ? 'bg-sky-500'
                              : leg.mode === 'bus'
                              ? 'bg-amber-500'
                              : 'bg-cyan-400'
                          }`}
                        />

                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white uppercase text-[11px] tracking-wide">
                            {leg.lineName || `${leg.mode.toUpperCase()} LEG`}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {leg.durationMinutes} mins • {leg.distanceMeters}m
                          </span>
                        </div>

                        <p className="text-slate-300">{leg.instructions}</p>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-slate-400">
                          {leg.cost > 0 && <span className="text-emerald-400 font-medium">Fare: ₹{leg.cost}</span>}
                          <span>Lighting: <strong className="text-slate-300">{leg.lightingQuality.toUpperCase()}</strong></span>
                          <span>Accessibility: <strong className="text-slate-300">{leg.isAccessible ? '✓ Step-Free' : 'Step Access'}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions & Sharing */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareJourney(route);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition border border-slate-700"
                    >
                      <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Share Planned Route</span>
                    </button>

                    <div className="text-[11px] text-slate-500 font-mono">
                      Demonstration Network • GTFS Sync Model
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
