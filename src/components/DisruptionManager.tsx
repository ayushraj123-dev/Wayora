/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DisruptionReport } from '../types';
import { METRO_LOCATIONS } from '../data/transitNetwork';
import { 
  AlertTriangle, 
  ThumbsUp, 
  PlusCircle, 
  ShieldAlert, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  RotateCcw,
  Sparkles,
  CloudRain
} from 'lucide-react';

interface DisruptionManagerProps {
  disruptions: DisruptionReport[];
  onAddDisruption: (disruption: DisruptionReport) => void;
  onUpvoteDisruption: (id: string) => void;
  onTriggerWeatherSimulation: () => void;
  onTriggerMissedTransfer: () => void;
  weatherActive: boolean;
}

export const DisruptionManager: React.FC<DisruptionManagerProps> = ({
  disruptions,
  onAddDisruption,
  onUpvoteDisruption,
  onTriggerWeatherSimulation,
  onTriggerMissedTransfer,
  weatherActive
}) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'flooding' | 'road-closure' | 'elevator-outage' | 'transit-delay'>('flooding');
  const [selectedLocationId, setSelectedLocationId] = useState(METRO_LOCATIONS[0].id);
  const [description, setDescription] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const handleCheckDuplicatesAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const loc = METRO_LOCATIONS.find((l) => l.id === selectedLocationId) || METRO_LOCATIONS[0];

    // Check if similar report exists within same location & category
    const duplicate = disruptions.find(
      (d) => d.locationName === loc.name && d.category === category
    );

    if (duplicate && !duplicateWarning) {
      setDuplicateWarning(
        `A similar report "${duplicate.title}" already exists at ${loc.name}. Submitting will corroborate the existing incident!`
      );
      onUpvoteDisruption(duplicate.id);
      return;
    }

    const newReport: DisruptionReport = {
      id: `disrupt-${Date.now()}`,
      title,
      category,
      severity: category === 'flooding' || category === 'road-closure' ? 'critical' : 'moderate',
      locationName: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      description,
      reportedAt: 'Just now',
      upvotes: 1,
      status: 'submitted',
      affectedRoutes: ['bus-101-citylink']
    };

    onAddDisruption(newReport);
    setShowReportModal(false);
    setTitle('');
    setDescription('');
    setDuplicateWarning(null);
  };

  return (
    <div className="space-y-4">
      {/* Simulation Controls Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white">Live Disruption & Resilience Engine</h4>
          </div>
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-cyan-500/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Report Incident</span>
          </button>
        </div>

        <p className="text-xs text-slate-400">
          WAYORA automatically reroutes around verified waterlogging, elevator outages, and missed connections in real time.
        </p>

        {/* Quick Simulation Toggles */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={onTriggerWeatherSimulation}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              weatherActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <CloudRain className={`w-3.5 h-3.5 ${weatherActive ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            <span>{weatherActive ? 'Simulated Monsoon Storm Active (Rerouting)' : 'Trigger Aravalli Monsoon / Jal Mahal Flood Scenario'}</span>
          </button>

          <button
            onClick={onTriggerMissedTransfer}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Test "I Missed My Bus" Recovery</span>
          </button>
        </div>
      </div>

      {/* Disruption Feed */}
      <div className="space-y-3">
        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>Active Community & Official Disruption Reports</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400">
            {disruptions.length} active
          </span>
        </h5>

        {disruptions.map((dis) => {
          const isCritical = dis.severity === 'critical';
          const isVerified = dis.status === 'verified';

          return (
            <div
              key={dis.id}
              className={`p-4 rounded-2xl border transition-all ${
                isCritical
                  ? 'bg-red-950/20 border-red-500/40'
                  : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase font-mono ${
                        isCritical
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {dis.category.replace('-', ' ')}
                    </span>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        isVerified
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isVerified && <CheckCircle2 className="w-3 h-3" />}
                      <span>{dis.status.toUpperCase()}</span>
                    </span>

                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {dis.reportedAt}
                    </span>
                  </div>

                  <h6 className="text-sm font-bold text-white">{dis.title}</h6>
                  <p className="text-xs text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{dis.locationName}</span>
                  </p>
                  <p className="text-xs text-slate-400 pt-1">{dis.description}</p>
                </div>

                {/* Upvote Button */}
                <button
                  onClick={() => onUpvoteDisruption(dis.id)}
                  className="flex flex-col items-center justify-center px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-cyan-400 transition"
                  title="Corroborate this report"
                >
                  <ThumbsUp className="w-4 h-4 mb-0.5" />
                  <span className="text-xs font-bold font-mono">{dis.upvotes}</span>
                  <span className="text-[9px] text-slate-400">Confirm</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Submit Journey Obstacle Report</span>
              </h4>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {duplicateWarning && (
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs">
                {duplicateWarning}
              </div>
            )}

            <form onSubmit={handleCheckDuplicatesAndSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Issue Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="flooding">Flooded Road / Waterlogging</option>
                  <option value="elevator-outage">Station Elevator / Ramp Outage</option>
                  <option value="road-closure">Road Closure / Blocked Sidewalk</option>
                  <option value="transit-delay">Bus / Metro Service Delay</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Location</label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  {METRO_LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Footpath flooded near north entrance"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observed Details</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe depth, detour difficulty, or affected transit vehicles..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition shadow-lg shadow-cyan-500/20"
                >
                  Submit for Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
