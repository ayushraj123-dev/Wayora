/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UserPreferences } from '../types';
import { Settings, X, Shield, Accessibility, Footprints, DollarSign, Moon, Database } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Mobility Preferences & Constraints</h3>
              <p className="text-xs text-slate-400">Personalize multi-modal journey scoring</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sliders for Constraints */}
        <div className="space-y-4 text-xs">
          {/* Max Walking Tolerance */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Footprints className="w-4 h-4 text-cyan-400" />
                <span>Maximum Walking Distance Cap</span>
              </span>
              <span className="font-mono font-bold text-cyan-400 text-sm">
                {preferences.maxWalkingDistanceMeters}m
              </span>
            </div>
            <input
              type="range"
              min="200"
              max="2000"
              step="100"
              value={preferences.maxWalkingDistanceMeters}
              onChange={(e) => onUpdatePreferences({ maxWalkingDistanceMeters: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>200m (Curbside drop-off)</span>
              <span>1000m (Standard)</span>
              <span>2000m (Active walker)</span>
            </div>
          </div>

          {/* Maximum Budget Limit */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Single Journey Fare Budget</span>
              </span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                ₹{preferences.maxBudget}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={preferences.maxBudget}
              onChange={(e) => onUpdatePreferences({ maxBudget: Number(e.target.value) })}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>₹10 (Subsidized Bus)</span>
              <span>₹50 (Standard Transit)</span>
              <span>₹100 (Unconstrained)</span>
            </div>
          </div>

          {/* Accessibility Toggles */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h5 className="font-bold text-slate-200 flex items-center gap-1.5">
              <Accessibility className="w-4 h-4 text-cyan-400" />
              <span>Accessibility & Safety Criteria</span>
            </h5>

            <label className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 cursor-pointer">
              <span className="text-slate-300">Strict Step-Free & Wheelchair Accessible Paths</span>
              <input
                type="checkbox"
                checked={preferences.requireWheelchairAccess}
                onChange={(e) => onUpdatePreferences({ requireWheelchairAccess: e.target.checked })}
                className="w-4 h-4 rounded accent-cyan-400"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 cursor-pointer">
              <span className="text-slate-300">Require Verified Working Station Elevators</span>
              <input
                type="checkbox"
                checked={preferences.requireElevators}
                onChange={(e) => onUpdatePreferences({ requireElevators: e.target.checked })}
                className="w-4 h-4 rounded accent-cyan-400"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 cursor-pointer">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Prefer Municipal Well-Lit Corridors (Night Mode)</span>
              </span>
              <input
                type="checkbox"
                checked={preferences.preferWellLit}
                onChange={(e) => onUpdatePreferences({ preferWellLit: e.target.checked })}
                className="w-4 h-4 rounded accent-cyan-400"
              />
            </label>
          </div>

          {/* Honest Data Status Notice */}
          <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-slate-300 space-y-1">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Data Transparency Notice</span>
            </div>
            <p>
              Current session uses WAYORA's connected demonstration multi-modal transit network with deterministic schedules, verified stop coordinates, and live disruption modeling. No private data is logged or transmitted externally.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition"
          >
            Save & Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
