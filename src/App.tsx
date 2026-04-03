import React, { useState, useEffect } from 'react';
import { Phone, Search, Settings, Clock, Star, Users, Grid, Plus, Sparkles, Brain, Volume2, Battery, Wifi, Signal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PERSONAS as INITIAL_PERSONAS, Persona } from './types';
import { CallScreen } from './components/CallScreen';
import { PersonaGenerator } from './components/PersonaGenerator';
import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>(INITIAL_PERSONAS);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastTap, setLastTap] = useState<{ id: string; time: number } | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [activeTab, setActiveTab] = useState<'contacts' | 'recents' | 'favorites' | 'keypad'>('contacts');
  const [selectedGender, setSelectedGender] = useState<'Girl' | 'Boy' | 'LGBTQ'>('Girl');
  const [callHistory, setCallHistory] = useState<{ id: string; persona: Persona; duration: number; timestamp: number }[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPlayingVoicemail, setIsPlayingVoicemail] = useState(false);

  const handlePersonaTap = (persona: Persona) => {
    const now = Date.now();
    if (lastTap && lastTap.id === persona.id && now - lastTap.time < 300) {
      // Double tap detected
      setActivePersona(persona);
      setLastTap(null);
    } else {
      setLastTap({ id: persona.id, time: now });
    }
  };

  const handleEndCall = (duration: number) => {
    if (activePersona) {
      setCallHistory(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        persona: activePersona,
        duration,
        timestamp: Date.now()
      }, ...prev]);
    }
    setActivePersona(null);
  };

  const analyzeHistory = async () => {
    if (callHistory.length === 0) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Analyze this call history and provide insights on the user's communication patterns and moods: ${JSON.stringify(callHistory)}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
      });
      setAnalysis(response.text || "No analysis available.");
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const playVoicemail = async (persona: Persona) => {
    setIsPlayingVoicemail(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Hey, it's ${persona.name}. I'm sorry I missed your call. I was just thinking about our last conversation. Give me a call back when you can!` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
        audio.onended = () => setIsPlayingVoicemail(false);
        await audio.play();
      }
    } catch (error) {
      console.error("Voicemail failed:", error);
      setIsPlayingVoicemail(false);
    }
  };

  const filteredPersonas = personas.filter(p => 
    p.gender === selectedGender &&
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     p.mood.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-screen-dynamic bg-slate-50 flex items-center justify-center overflow-hidden">
      {/* App Container */}
      <div className="w-full h-full max-w-md bg-white relative flex flex-col overflow-hidden shadow-2xl">
        
        <AnimatePresence>
          {activePersona && (
            <CallScreen 
              persona={activePersona} 
              onEndCall={(duration) => handleEndCall(duration)} 
            />
          )}
          {showGenerator && (
            <PersonaGenerator 
              onCreated={(p) => {
                setPersonas([p, ...personas]);
                setShowGenerator(false);
              }}
              onClose={() => setShowGenerator(false)}
            />
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight text-blue-600">
                LoveCall
              </h1>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setShowGenerator(true)}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus size={20} />
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <Settings size={20} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* Gender Filter */}
            {activeTab === 'contacts' && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                {['Girl', 'Boy', 'LGBTQ'].map((gender) => (
                  <button
                    key={gender}
                    onClick={() => setSelectedGender(gender as any)}
                    className={`px-6 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                      selectedGender === gender 
                        ? 'bg-blue-600 text-white shadow-md scale-105' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {gender.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 pb-24 scrollbar-hide">
          {activeTab === 'contacts' && (
            <>
              {/* Search Bar */}
              <div className="relative mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Search by name or mood..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-200/50 border-none rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
              </div>

              {/* Persona List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Available Now</h2>
                  <span className="text-xs text-slate-400">Double tap to call</span>
                </div>
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  {filteredPersonas.map((persona, index) => (
                    <motion.div
                      key={persona.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handlePersonaTap(persona)}
                      className="group relative flex items-center p-4 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-none select-none"
                    >
                      <div className="relative">
                        <img 
                          src={persona.avatar} 
                          alt={persona.name} 
                          className="w-14 h-14 rounded-full object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      
                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-lg">{persona.name}</h3>
                          <span className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-600 rounded-full">
                            {persona.mood}
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm line-clamp-1">{persona.description}</p>
                      </div>

                      <div className="flex items-center space-x-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); playVoicemail(persona); }}
                          className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 hover:bg-blue-200 transition-colors"
                        >
                          <Volume2 size={18} />
                        </button>
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                          <Phone size={18} fill="currentColor" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'recents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Call History</h2>
                <button 
                  onClick={analyzeHistory}
                  disabled={isAnalyzing || callHistory.length === 0}
                  className="flex items-center space-x-2 text-blue-600 font-bold hover:text-blue-700 disabled:opacity-50"
                >
                  <Brain size={20} />
                  <span>{isAnalyzing ? 'Analyzing...' : 'Deep Analysis'}</span>
                </button>
              </div>

              {analysis && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-blue-900 text-sm leading-relaxed"
                >
                  <h4 className="font-bold mb-2 flex items-center space-x-2">
                    <Sparkles size={16} />
                    <span>AI Insights</span>
                  </h4>
                  {analysis}
                </motion.div>
              )}

              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {callHistory.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">No recent calls.</div>
                ) : (
                  callHistory.map((call, index) => (
                    <div key={call.id} className="flex items-center p-4 border-b border-slate-50 last:border-none">
                      <img src={call.persona.avatar} alt="" className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                      <div className="ml-4 flex-1">
                        <h3 className="font-bold">{call.persona.name}</h3>
                        <p className="text-xs text-slate-500">{new Date(call.timestamp).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-600">{call.duration}s</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Outgoing</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {filteredPersonas.length === 0 && activeTab === 'contacts' && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={32} className="text-slate-300" />
              </div>
              <p className="text-slate-500">No contacts found matching your search.</p>
            </div>
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-6 py-3 z-10">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setActiveTab('contacts')}
              className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'contacts' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Users size={24} />
              <span className="text-[10px] font-bold">Contacts</span>
            </button>
            <button 
              onClick={() => setActiveTab('recents')}
              className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'recents' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Clock size={24} />
              <span className="text-[10px] font-bold">Recents</span>
            </button>
            <button 
              onClick={() => setActiveTab('favorites')}
              className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'favorites' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Star size={24} />
              <span className="text-[10px] font-bold">Favorites</span>
            </button>
            <button 
              onClick={() => setActiveTab('keypad')}
              className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'keypad' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid size={24} />
              <span className="text-[10px] font-bold">Keypad</span>
            </button>
          </div>
          {/* Home Indicator */}
          <div className="w-32 h-1 bg-slate-200 rounded-full mx-auto mt-4 mb-1" />
        </nav>
      </div>
    </div>
  );
}
