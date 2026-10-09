/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { METRO_LOCATIONS } from '../data/transitNetwork';
import { 
  X, 
  User, 
  LogIn, 
  LogOut, 
  Bookmark, 
  CheckCircle2, 
  ShieldCheck, 
  Settings2, 
  Trash2, 
  ArrowRight, 
  Sparkles,
  Train,
  Bus,
  Footprints,
  Compass,
  Clock,
  HeartHandshake,
  Mail
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSavedRoute?: (originId: string, destinationId: string) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onSelectSavedRoute
}) => {
  const { 
    user, 
    profile, 
    savedRoutes, 
    loading, 
    authError,
    setAuthError,
    signInWithGoogle, 
    continueAsGuest,
    signOutUser, 
    removeSavedRoute, 
    updateUserPreferences 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'routes' | 'preferences'>('routes');
  const [selectedOrigin, setSelectedOrigin] = useState(profile?.defaultOriginId || 'mansarovar-terminal');
  const [selectedDest, setSelectedDest] = useState(profile?.defaultDestinationId || 'badi-chaupar');
  const [preferredMode, setPreferredMode] = useState(profile?.preferredMode || 'all');
  const [wheelchair, setWheelchair] = useState(profile?.wheelchairAccessible || false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSavePreferences = async () => {
    await updateUserPreferences({
      defaultOriginId: selectedOrigin,
      defaultDestinationId: selectedDest,
      preferredMode,
      wheelchairAccessible: wheelchair
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2200);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Traveler Profile & Account</h3>
              <p className="text-xs text-slate-400">Cloud synchronized Jaipur mobility profile</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {!user ? (
            /* NOT LOGGED IN STATE */
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-xl">
                <Compass className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-xs mx-auto">
                <h4 className="text-lg font-bold text-white">Sign In to WAYORA</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Log in with Google to sync your saved Jaipur commute routes, preferred stations, and accessibility settings across devices.
                </p>
              </div>

              {/* Auth Notice / Error if any */}
              {authError && (
                <div className="max-w-sm mx-auto p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start justify-between gap-2 text-left">
                  <span>{authError}</span>
                  <button 
                    onClick={() => setAuthError(null)} 
                    className="text-amber-400 hover:text-white shrink-0 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Perks list */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-left text-xs space-y-2.5 max-w-sm mx-auto">
                <div className="flex items-center gap-2 text-slate-300">
                  <Bookmark className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Bookmark favorite Pink Line & Bus corridors</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Personalized lighting & step-free safety filters</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />
                  <span>Persistent cloud sync via Google Firebase</span>
                </div>
              </div>

              <div className="space-y-2 max-w-sm mx-auto">
                <button
                  onClick={signInWithGoogle}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-cyan-500/20 hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>

                <button
                  onClick={continueAsGuest}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Explore as Demo Traveler</span>
                </button>
              </div>
            </div>
          ) : (
            /* LOGGED IN USER PROFILE */
            <div className="space-y-6">
              {/* User Identity Card */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'User'} 
                      className="w-13 h-13 rounded-2xl border-2 border-cyan-400/50 object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-13 h-13 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xl">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-base leading-tight">
                        {user.displayName || 'Jaipur Commuter'}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-semibold">
                        Verified
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</p>
                    <span className="text-[10px] text-cyan-400/80 font-mono mt-1 block">
                      ID: {user.uid.slice(0, 10)}...
                    </span>
                  </div>
                </div>

                <button
                  onClick={signOutUser}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 border border-slate-700 transition"
                  title="Sign out of account"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Subtabs */}
              <div className="flex items-center p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveTab('routes')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'routes'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Saved Corridors ({savedRoutes.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('preferences')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'preferences'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Commute Preferences</span>
                </button>
              </div>

              {/* TAB 1: SAVED CORRIDORS */}
              {activeTab === 'routes' && (
                <div className="space-y-3">
                  {savedRoutes.length === 0 ? (
                    <div className="text-center py-8 bg-slate-950/40 rounded-2xl border border-slate-800/60 p-4 space-y-2">
                      <Bookmark className="w-6 h-6 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">No saved transit corridors yet.</p>
                      <p className="text-[11px] text-slate-500">
                        Click the bookmark button on any route card in the planner to save your frequent journeys.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {savedRoutes.map((saved) => (
                        <div
                          key={saved.id}
                          className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs truncate">
                                {saved.title}
                              </span>
                              {saved.categoryTag && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                  {saved.categoryTag}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1">
                              <span>{saved.originName?.split('(')[0] || 'Origin'}</span>
                              <ArrowRight className="w-3 h-3 text-slate-600" />
                              <span>{saved.destinationName?.split('(')[0] || 'Destination'}</span>
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                              <span>⏱ {saved.durationMinutes} mins</span>
                              <span>₹{saved.fare}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {onSelectSavedRoute && (
                              <button
                                onClick={() => {
                                  onSelectSavedRoute(saved.originId, saved.destinationId);
                                  onClose();
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition flex items-center gap-1"
                                title="Load this route into the planner"
                              >
                                <span>Load</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => removeSavedRoute(saved.id)}
                              className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-300 transition"
                              title="Delete bookmark"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: COMMUTE PREFERENCES */}
              {activeTab === 'preferences' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-medium block">Default Origin Hub:</label>
                      <select
                        value={selectedOrigin}
                        onChange={(e) => setSelectedOrigin(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-cyan-500 focus:outline-none"
                      >
                        {METRO_LOCATIONS.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name.split('(')[0].trim()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-medium block">Default Destination:</label>
                      <select
                        value={selectedDest}
                        onChange={(e) => setSelectedDest(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-cyan-500 focus:outline-none"
                      >
                        {METRO_LOCATIONS.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name.split('(')[0].trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <label className="text-slate-400 font-medium block">Preferred Mode Focus:</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'all', label: 'Balanced', icon: Compass },
                        { id: 'metro', label: 'Pink Metro', icon: Train },
                        { id: 'bus', label: 'JCTSL Bus', icon: Bus },
                        { id: 'walking', label: 'Walking', icon: Footprints }
                      ].map((m) => {
                        const Icon = m.icon;
                        const isSelected = preferredMode === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPreferredMode(m.id as any)}
                            className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition text-center ${
                              isSelected
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-[10px]">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-white block">Step-Free Wheelchair Access</span>
                      <span className="text-[10px] text-slate-400">Prioritize elevators, ramps, and level boarding</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={wheelchair}
                      onChange={(e) => setWheelchair(e.target.checked)}
                      className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleSavePreferences}
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
                  >
                    {saveSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                        <span>Preferences Saved to Cloud!</span>
                      </>
                    ) : (
                      <span>Save Commute Preferences</span>
                    )}
                  </button>
                </div>
              )}

              {/* Developer Contact Card */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-[10px]">
                      AR
                    </div>
                    <div>
                      <p className="font-semibold text-white text-[11px]">Developer Support</p>
                      <p className="text-[10px] text-slate-400">Ayush Raj</p>
                    </div>
                  </div>
                  <a
                    href="mailto:ayushraj20062007@gmail.com?subject=WAYORA%20Transit%20Intelligence%20Inquiry"
                    className="px-2.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] transition flex items-center gap-1.5 shadow"
                    title="Email Ayush Raj"
                  >
                    <Mail className="w-3 h-3" />
                    <span>Contact</span>
                  </a>
                </div>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                  ayushraj20062007@gmail.com
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
