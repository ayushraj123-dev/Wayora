/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertOctagon, PhoneCall, HeartPulse, ShieldAlert, ArrowRight, X } from 'lucide-react';
import { EMERGENCY_CONTACTS } from '../data/transitNetwork';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteToHospital: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  onRouteToHospital
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-red-500/50 rounded-3xl p-6 shadow-2xl shadow-red-950/50 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <HeartPulse className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Emergency Priority Mode
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                  Rapid Routing
                </span>
              </h3>
              <p className="text-xs text-slate-400">Immediate access to medical trauma centers and helpline contacts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clear Disclaimer */}
        <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 flex items-start gap-2.5">
          <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <strong>Emergency Advisory:</strong> WAYORA is an intelligent journey planner for urban mobility, not an emergency dispatch operator. For life-threatening emergencies, immediately dial national emergency telephone services below.
          </div>
        </div>

        {/* 1-Click Route to Hospital Action */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">Sawai Man Singh (SMS) Hospital & Trauma Center</h4>
              <p className="text-xs text-slate-400">JLN Marg Emergency Gate 1 • JCTSL Route 9A & Jaipur Metro Link</p>
            </div>
            <button
              onClick={() => {
                onRouteToHospital();
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition shadow-lg shadow-red-500/30"
            >
              <span>Route Me Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Verified Official Emergency Helplines */}
        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Verified Emergency Contacts
          </h5>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {EMERGENCY_CONTACTS.map((contact, i) => (
              <a
                key={i}
                href={`tel:${contact.number.split(' ')[0]}`}
                className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition flex items-center justify-between text-slate-200 group"
              >
                <div>
                  <div className="font-semibold text-slate-100 group-hover:text-cyan-400 transition">{contact.name}</div>
                  <div className="text-cyan-400 font-mono text-[11px] font-bold">{contact.number}</div>
                </div>
                <PhoneCall className="w-4 h-4 text-cyan-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
