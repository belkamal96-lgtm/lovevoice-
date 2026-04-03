import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Grid, User, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Persona, AudioStreamer } from '../types';
import { GoogleGenAI, Modality } from "@google/genai";

interface CallScreenProps {
  persona: Persona;
  onEndCall: () => void;
}

export const CallScreen: React.FC<CallScreenProps> = ({ persona, onEndCall }) => {
  const [status, setStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const sessionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [transcript, setTranscript] = useState<{ text: string; isUser: boolean }[]>([]);

  useEffect(() => {
    const el = document.getElementById('transcript-end');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    const startCall = async () => {
      // Simulate calling delay
      const timer = setTimeout(() => {
        setStatus('connected');
      }, 2000);

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        audioStreamerRef.current = new AudioStreamer(24000);
        await audioStreamerRef.current.start();

        const session = await ai.live.connect({
          model: "gemini-3.1-flash-live-preview",
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: persona.systemInstruction,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voice } }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          },
          callbacks: {
            onopen: () => {
              console.log("Live session opened");
              startMic();
            },
            onmessage: (message: any) => {
              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio && audioStreamerRef.current) {
                audioStreamerRef.current.addChunk(base64Audio);
              }

              // Handle transcriptions
              const modelText = message.serverContent?.modelTurn?.parts?.[0]?.text;
              if (modelText) {
                setTranscript(prev => [...prev, { text: modelText, isUser: false }]);
              }

              // Check for user transcription in serverContent
              const userText = message.serverContent?.userTurn?.parts?.[0]?.text;
              if (userText) {
                setTranscript(prev => [...prev, { text: userText, isUser: true }]);
              }

              if (message.serverContent?.interrupted) {
                // Handle interruption if needed
              }
            },
            onclose: () => {
              console.log("Live session closed");
              onEndCall();
            },
            onerror: (err) => {
              console.error("Live session error:", err);
              onEndCall();
            }
          }
        });

        sessionRef.current = session;
      } catch (error) {
        console.error("Failed to start call:", error);
        onEndCall();
      }

      return () => clearTimeout(timer);
    };

    startCall();

    return () => {
      stopMic();
      if (sessionRef.current) sessionRef.current.close();
      if (audioStreamerRef.current) audioStreamerRef.current.stop();
    };
  }, [persona]);

  useEffect(() => {
    let interval: number;
    if (status === 'connected') {
      interval = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (isMuted) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert float32 to int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        if (sessionRef.current) {
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      };
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopMic = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="absolute inset-0 bg-slate-900 text-white z-50 flex flex-col items-center justify-between py-20 px-6"
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-700 shadow-2xl">
          <img src={persona.avatar} alt={persona.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">{persona.name}</h2>
          <p className="text-slate-400 text-lg mt-1">{persona.number}</p>
          <p className="text-blue-400 font-medium mt-2">
            {status === 'calling' ? 'Calling...' : formatDuration(duration)}
          </p>
        </div>
      </div>

      {/* Transcript Log */}
      <div className="w-full max-w-md h-40 overflow-y-auto px-4 space-y-2 scrollbar-hide mask-fade-edges">
        {transcript.map((t, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: t.isUser ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex ${t.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${t.isUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
              {t.text}
            </div>
          </motion.div>
        ))}
        <div id="transcript-end" />
      </div>

      <div className="grid grid-cols-3 gap-8 w-full max-w-xs">
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className={`flex flex-col items-center space-y-2 group`}
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-white text-slate-900' : 'bg-slate-800 text-white group-hover:bg-slate-700'}`}>
            {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
          </div>
          <span className="text-sm font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        <button className="flex flex-col items-center space-y-2 group">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
            <Grid size={28} />
          </div>
          <span className="text-sm font-medium">Keypad</span>
        </button>

        <button 
          onClick={() => setIsSpeaker(!isSpeaker)}
          className="flex flex-col items-center space-y-2 group"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isSpeaker ? 'bg-white text-slate-900' : 'bg-slate-800 text-white group-hover:bg-slate-700'}`}>
            <Volume2 size={28} />
          </div>
          <span className="text-sm font-medium">Speaker</span>
        </button>

        <button className="flex flex-col items-center space-y-2 group">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
            <User size={28} />
          </div>
          <span className="text-sm font-medium">Contacts</span>
        </button>

        <div className="col-span-1"></div>

        <button className="flex flex-col items-center space-y-2 group">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
            <Clock size={28} />
          </div>
          <span className="text-sm font-medium">Recent</span>
        </button>
      </div>

      <button 
        onClick={onEndCall}
        className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors active:scale-90"
      >
        <PhoneOff size={36} fill="currentColor" />
      </button>
    </motion.div>
  );
};
