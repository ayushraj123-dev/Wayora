/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Send, Sparkles, Bot, User, CheckCircle2, RefreshCw } from 'lucide-react';
import { AuraMessage, UserPreferences } from '../types';
import { METRO_LOCATIONS } from '../data/transitNetwork';

interface AuraAssistantProps {
  onApplyPreferences: (updates: Partial<UserPreferences>) => void;
  onTriggerRecalculation?: () => void;
  currentPreferences: UserPreferences;
  selectedRouteTitle?: string;
}

export const AuraAssistant: React.FC<AuraAssistantProps> = ({
  onApplyPreferences,
  onTriggerRecalculation,
  currentPreferences,
  selectedRouteTitle
}) => {
  const [messages, setMessages] = useState<AuraMessage[]>([
    {
      id: 'welcome',
      sender: 'aura',
      text: "Namaste! I'm Aura, your intelligent travel co-pilot for Jaipur. Where would you like to travel today, or how can I tailor your route across Jaipur Metro, JCTSL low-floor buses, and safe walking corridors?",
      timestamp: 'Just now'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);

  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    if ('speechSynthesis' in window) {
      setSpeechSynthesisSupported(true);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // Text to speech helper
  const speakText = (text: string) => {
    if (voiceMuted || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. You can type commands below!');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      stopSpeaking();
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Mic start failed:', err);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isProcessing) return;

    setInputText('');
    stopSpeaking();

    const userMsg: AuraMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const response = await fetch('/api/aura/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          currentContext: {
            ...currentPreferences,
            activeRoute: selectedRouteTitle
          },
          history: messages.map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text }))
        })
      });

      const data = await response.json();
      const replyText = data.reply || "I've checked the network and adjusted your travel itinerary.";

      // Apply extracted structured actions if any
      if (data.action) {
        const updates: Partial<UserPreferences> = {};
        if (data.action.destination) {
          const destQuery = String(data.action.destination).toLowerCase();
          const matched = METRO_LOCATIONS.find(
            (l) =>
              l.id.toLowerCase() === destQuery ||
              l.name.toLowerCase().includes(destQuery) ||
              destQuery.includes(l.id.toLowerCase())
          );
          if (matched) {
            updates.destinationId = matched.id;
          }
        }
        if (data.action.origin) {
          const origQuery = String(data.action.origin).toLowerCase();
          const matched = METRO_LOCATIONS.find(
            (l) =>
              l.id.toLowerCase() === origQuery ||
              l.name.toLowerCase().includes(origQuery) ||
              origQuery.includes(l.id.toLowerCase())
          );
          if (matched) {
            updates.originId = matched.id;
          }
        }
        if (data.action.comparisonMode) {
          updates.comparisonMode = data.action.comparisonMode;
        }
        if (data.action.maxBudget) {
          updates.maxBudget = data.action.maxBudget;
        }
        if (data.action.maxWalkingMeters) {
          updates.maxWalkingDistanceMeters = data.action.maxWalkingMeters;
        }
        if (data.action.weatherDisruption !== undefined) {
          updates.weatherAlertActive = Boolean(data.action.weatherDisruption);
          updates.avoidFloodedAreas = Boolean(data.action.weatherDisruption);
        }
        if (Object.keys(updates).length > 0) {
          onApplyPreferences(updates);
        }
        if (data.action.triggerMissedTransfer && onTriggerRecalculation) {
          onTriggerRecalculation();
        }
      }

      const auraMsg: AuraMessage = {
        id: `aura-${Date.now()}`,
        sender: 'aura',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, auraMsg]);
      speakText(replyText);
    } catch (err) {
      console.error('Aura response error:', err);
      const fallbackMsg: AuraMessage = {
        id: `aura-err-${Date.now()}`,
        sender: 'aura',
        text: "I've optimized your Jaipur multi-modal transit options based on real-time schedule information.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      speakText(fallbackMsg.text);
    } finally {
      setIsProcessing(false);
    }
  };

  const samplePrompts = [
    'Take me to SMS Hospital urgently',
    'Fastest route to World Trade Park (WTP)',
    'Jaipur Junction to Amer Fort heritage route',
    'Pink Line Metro to Badi Chaupar (Hawa Mahal)',
    'Avoid flood-prone Jal Mahal Amer road',
    'Cheapest JCTSL bus to Airport Sanganer',
    'I missed my bus at Sindhi Camp Hub'
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              WAYORA Aura
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                AI Voice Co-Pilot
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Context-Aware Multi-Modal Intelligence</p>
          </div>
        </div>

        {/* Audio Controls */}
        <div className="flex items-center gap-1.5">
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition"
              title="Stop Aura Speaking"
            >
              Stop Voice
            </button>
          )}

          <button
            onClick={() => {
              setVoiceMuted(!voiceMuted);
              if (!voiceMuted) stopSpeaking();
            }}
            className={`p-2 rounded-xl transition ${
              voiceMuted ? 'text-slate-500 hover:text-slate-400' : 'text-cyan-400 hover:bg-slate-800'
            }`}
            title={voiceMuted ? 'Unmute Aura Voice' : 'Mute Aura Voice'}
          >
            {voiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'aura' && (
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-md leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-cyan-600 text-white rounded-tr-none'
                  : 'bg-slate-800/90 border border-slate-700/60 text-slate-200 rounded-tl-none'
              }`}
            >
              <p>{msg.text}</p>
              <span className={`block text-[10px] mt-1 ${msg.sender === 'user' ? 'text-cyan-200' : 'text-slate-400'}`}>
                {msg.timestamp}
              </span>
            </div>

            {msg.sender === 'user' && (
              <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-cyan-400 text-xs py-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Aura is synchronizing multi-modal transit schedules...</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-3 py-2 bg-slate-950/60 border-t border-slate-800/60 overflow-x-auto">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {samplePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box & Mic */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800">
        <div className="flex items-center gap-2">
          {/* Mic Button */}
          <button
            onClick={toggleListening}
            className={`p-2.5 rounded-xl transition-all shadow-md ${
              isListening
                ? 'bg-red-500 text-white animate-pulse shadow-red-500/50'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30'
            }`}
            title={isListening ? 'Stop Listening' : 'Speak to Aura (Speech-to-Text)'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={isListening ? 'Listening to your voice...' : 'Ask Aura to plan, compare, or reroute...'}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />

          {/* Send Button */}
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isProcessing}
            className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 transition font-bold"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Listening Soundwave indicator */}
        {isListening && (
          <div className="flex items-center justify-center gap-1 mt-2 text-red-400 text-[11px]">
            <span className="w-1.5 h-3 bg-red-400 rounded-full animate-bounce" />
            <span className="w-1.5 h-5 bg-red-400 rounded-full animate-bounce [animation-delay:0.1s]" />
            <span className="w-1.5 h-3 bg-red-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="ml-2 font-mono">Microphone Active — Speak Now</span>
          </div>
        )}
      </div>
    </div>
  );
};
