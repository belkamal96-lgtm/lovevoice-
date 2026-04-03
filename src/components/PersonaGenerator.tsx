import React, { useState } from 'react';
import { Sparkles, Loader2, Plus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { Persona } from '../types';

interface PersonaGeneratorProps {
  onCreated: (persona: Persona) => void;
  onClose: () => void;
}

export const PersonaGenerator: React.FC<PersonaGeneratorProps> = ({ onCreated, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [gender, setGender] = useState<'Girl' | 'Boy' | 'LGBTQ'>('Girl');
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePersona = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: `Create a unique AI persona for a phone call. 
        Gender: ${gender}
        Description: "${prompt}". 
        Return a JSON object with: name, mood, description, and systemInstruction (a detailed prompt for the AI to act as this person during a voice call).
        The systemInstruction should emphasize natural, concise, and conversational speech.`,
        config: { responseMimeType: "application/json" }
      });

      const voices: ('Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr')[] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const randomVoice = voices[Math.floor(Math.random() * voices.length)];

      const data = JSON.parse(response.text || '{}');
      const newPersona: Persona = {
        id: Math.random().toString(36).substr(2, 9),
        name: data.name || "New Persona",
        mood: data.mood || "Custom",
        gender: gender,
        voice: randomVoice,
        description: data.description || "A custom generated persona.",
        avatar: `https://picsum.photos/seed/${data.name}/200`,
        number: `+1 (555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
        systemInstruction: data.systemInstruction || "You are a helpful assistant."
      };
      onCreated(newPersona);
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm"
    >
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full">
          <X size={20} className="text-slate-400" />
        </button>
        
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
            <Sparkles size={24} />
          </div>
          <h2 className="text-2xl font-bold">Create Persona</h2>
        </div>

        <div className="mb-6">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 block">Select Gender</label>
          <div className="flex space-x-2">
            {(['Girl', 'Boy', 'LGBTQ'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                  gender === g 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {g.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <p className="text-slate-500 mb-6">Describe the person you want to talk to. Their personality, mood, and how they should sound.</p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A wise old mentor who gives life advice with a touch of humor..."
          className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-6"
        />

        <button
          onClick={generatePersona}
          disabled={isGenerating || !prompt.trim()}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all"
        >
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Plus size={20} />
              <span>Create Persona</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
