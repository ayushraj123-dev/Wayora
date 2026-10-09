/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Mail,
  X,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Send,
  User,
  ShieldCheck,
  MapPin,
  Heart
} from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [subject, setSubject] = useState('Inquiry regarding WAYORA Jaipur Multi-Modal Transit');
  const [message, setMessage] = useState('');
  const [inquiryType, setInquiryType] = useState<'general' | 'bug' | 'feature' | 'data'>('general');

  if (!isOpen) return null;

  const contactName = 'Ayush Raj';
  const contactEmail = 'ayushraj20062007@gmail.com';

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const getMailtoUrl = () => {
    const encodedSubject = encodeURIComponent(`[WAYORA] ${subject}`);
    const encodedBody = encodeURIComponent(
      message ? `${message}\n\n---\nSent via WAYORA Transit Intelligence App` : `Hi Ayush,\n\nI have an inquiry regarding the WAYORA Jaipur Transit Planner.\n\n`
    );
    return `mailto:${contactEmail}?subject=${encodedSubject}&body=${encodedBody}`;
  };

  const getGmailWebUrl = () => {
    const encodedSubject = encodeURIComponent(`[WAYORA] ${subject}`);
    const encodedBody = encodeURIComponent(
      message ? `${message}\n\n---\nSent via WAYORA Transit Intelligence App` : `Hi Ayush,\n\n`
    );
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contactEmail)}&su=${encodedSubject}&body=${encodedBody}`;
  };

  const handleInquiryTypeSelect = (type: 'general' | 'bug' | 'feature' | 'data') => {
    setInquiryType(type);
    switch (type) {
      case 'bug':
        setSubject('Bug Report / Issue in Jaipur Multi-Modal Planner');
        break;
      case 'feature':
        setSubject('Feature Suggestion for WAYORA');
        break;
      case 'data':
        setSubject('Jaipur GTFS / Metro / Bus Route Data Inquiry');
        break;
      default:
        setSubject('Inquiry regarding WAYORA Jaipur Multi-Modal Transit');
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Contact Us</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Developer Direct
                </span>
              </h2>
              <p className="text-xs text-slate-400">Connect with the creator of WAYORA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            aria-label="Close contact modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Creator Profile Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-sky-400 p-0.5 shadow-lg shadow-cyan-500/20 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-400 font-extrabold text-xl font-mono">
                  AR
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-white tracking-tight">{contactName}</h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Creator
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <User className="w-3 h-3 text-cyan-400" />
                  <span>Lead Engineer & Designer • WAYORA Transit</span>
                </p>
                <div className="mt-2.5 flex items-center gap-2 text-xs font-mono text-cyan-300 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 w-fit max-w-full">
                  <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{contactEmail}</span>
                </div>
              </div>
            </div>

            {/* Direct Email Action Buttons */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Primary: Open Email Client */}
              <a
                href={getMailtoUrl()}
                className="w-full px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                <span>Email {contactName}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* Secondary: Open in Gmail Web */}
              <a
                href={getGmailWebUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-3.5 h-3.5 text-red-400" />
                <span>Open in Gmail Web</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            </div>

            {/* Quick Copy Email Action */}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
              <span className="text-[11px]">Direct address: <strong className="text-slate-300 font-mono">{contactEmail}</strong></span>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 rounded-lg border border-cyan-500/30 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Email</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Message Composer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Compose Message / Subject</span>
              </span>
              <span className="text-[11px] text-slate-400">Pre-formats your email</span>
            </div>

            {/* Category Quick Pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleInquiryTypeSelect('general')}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                  inquiryType === 'general'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-semibold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                General Inquiry
              </button>
              <button
                type="button"
                onClick={() => handleInquiryTypeSelect('bug')}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                  inquiryType === 'bug'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-semibold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                Bug Report
              </button>
              <button
                type="button"
                onClick={() => handleInquiryTypeSelect('feature')}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                  inquiryType === 'feature'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-semibold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                Feature Suggestion
              </button>
              <button
                type="button"
                onClick={() => handleInquiryTypeSelect('data')}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                  inquiryType === 'data'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-semibold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                Jaipur Transit Data
              </button>
            </div>

            {/* Subject Input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                placeholder="Enter email subject"
              />
            </div>

            {/* Message Textarea */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Message Preview</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                placeholder="Type your message, query, or feedback for Ayush Raj..."
              />
            </div>

            {/* Launch Email Client CTA */}
            <a
              href={getMailtoUrl()}
              className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Launch Email with this Message</span>
            </a>
          </div>

          {/* Project Details */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>WAYORA — Jaipur Smart Transit Multi-Modal Engine</span>
            </div>
            <p>
              Developed by <strong className="text-white">{contactName}</strong> for real-time intelligent transit routing, 3D corridor visualization, and flood-resilient journey planning across Jaipur.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs">
          <span className="text-slate-500 flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-rose-500 fill-current" /> by {contactName}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
