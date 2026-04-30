"use client";

import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default function Home() {
  const [apiKey, setApiKey] = useState("AIzaSyAvKMsnYrNka5yajnIJU38VYGWncUellKA");
  const [modelName, setModelName] = useState("gemini-3.1-flash-tts-preview");
  const [context, setContext] = useState("Premium commercial. Tone is polished, persuasive, and inviting. Comportate como un guia turístico que lleva a un grupo y que cobrará en función de como entusiasme al grupo, asi que intenta envaucarlos en cada parada.");
  const [scene, setScene] = useState("The Sound Stage Booth.");
  const [speaker, setSpeaker] = useState("Orus (Firm, Lower middle pitch).");
  
  const [fragments, setFragments] = useState([{ id: Date.now(), name: "Fragmento 1", text: "", resultUrl: "", loading: false, error: "" }]);

  const handleAddFragment = () => {
    const nextNum = fragments.length + 1;
    setFragments([...fragments, { id: Date.now(), name: `Fragmento ${nextNum}`, text: "", resultUrl: "", loading: false, error: "" }]);
  };

  const handleUpdateText = (index: number, text: string) => {
    const newFragments = [...fragments];
    newFragments[index].text = text;
    setFragments(newFragments);
  };

  const handleUpdateName = (index: number, name: string) => {
    const newFragments = [...fragments];
    newFragments[index].name = name;
    setFragments(newFragments);
  };
  
  // Función para añadir cabecera WAV a audio PCM L16
  const addWavHeader = (base64Data: string, sampleRate: number = 24000) => {
    const raw = atob(base64Data);
    const buffer = new ArrayBuffer(44 + raw.length);
    const view = new DataView(buffer);
    
    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // "RIFF"
    // file length
    view.setUint32(4, 36 + raw.length, true);
    // RIFF type
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // format chunk identifier
    view.setUint32(12, 0x666d7420, false); // "fmt "
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, 1, true); // Mono
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    view.setUint32(36, 0x64617461, false); // "data"
    // data chunk length
    view.setUint32(40, raw.length, true);
    
    // write the PCM data
    for (let i = 0; i < raw.length; i++) {
      view.setUint8(44 + i, raw.charCodeAt(i));
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const handleGenerate = async (index: number) => {
    if (!apiKey) {
      alert("Por favor introduce una API Key");
      return;
    }

    const fragment = fragments[index];
    if (!fragment.text.trim()) {
      alert("Por favor introduce texto");
      return;
    }

    // Update state to loading
    const newFragments = [...fragments];
    newFragments[index] = { ...fragment, loading: true, error: "", resultUrl: "" };
    setFragments(newFragments);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      
      const payload: any = {
        contents: [{ 
          role: "user", 
          parts: [{ 
            text: `Scene: ${scene} Context: ${context} Speaker: ${speaker}\n\nTexto a convertir: ${fragment.text}` 
          }] 
        }],
        generationConfig: {
          response_modalities: ["AUDIO"],
          temperature: 1.0
        }
      };

      // Solo añadir speech_config si parece ser un modelo TTS específico
      if (modelName.includes("tts")) {
        payload.generationConfig.speech_config = {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: speaker.split(' ')[0]
            }
          }
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Error de API: ${response.status}`);
      }

      const data = await response.json();
      console.log("Respuesta de Gemini:", data);
      
      if (!data.candidates || data.candidates.length === 0) {
        if (data.promptFeedback?.blockReason) {
          throw new Error(`La petición fue bloqueada: ${data.promptFeedback.blockReason}`);
        }
        throw new Error("El modelo no generó ninguna respuesta (candidates vacíos).");
      }

      const candidate = data.candidates[0];
      if (candidate.finishReason && candidate.finishReason !== "STOP") {
        throw new Error(`La generación terminó de forma inesperada: ${candidate.finishReason}`);
      }

      let base64Audio = "";
      let mimeType = "";
      
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Audio = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "";
          break;
        }
      }

      if (base64Audio) {
        let finalAudioUrl = "";
        
        // Si el audio es L16 (PCM), necesitamos añadir la cabecera WAV
        if (mimeType.includes("l16")) {
          console.log("Audio L16 detectado. Añadiendo cabecera WAV...");
          const wavBlob = addWavHeader(base64Audio, 24000);
          finalAudioUrl = URL.createObjectURL(wavBlob);
        } else {
          finalAudioUrl = `data:${mimeType || 'audio/mp3'};base64,${base64Audio}`;
        }

        setFragments(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], loading: false, resultUrl: finalAudioUrl };
          return updated;
        });
      } else {
        throw new Error("La respuesta no contiene datos de audio. Verifica el texto o la configuración.");
      }

    } catch (err: any) {
      console.error(err);
      setFragments(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], loading: false, error: err.message || "Error al generar audio" };
        return updated;
      });
    }
  };

  const handleGenerateAll = async () => {
    for (let i = 0; i < fragments.length; i++) {
      if (fragments[i].text.trim() && !fragments[i].resultUrl) {
        await handleGenerate(i);
      }
    }
  };

  const handleRemoveFragment = (index: number) => {
    if (fragments.length > 1) {
      setFragments(fragments.filter((_, i) => i !== index));
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="border-b border-neutral-800 pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            🚀 GENERADOR TTS v2
          </h1>
          <p className="text-neutral-400 mt-2">Generador de audio con Next.js + Tailwind</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Configuración */}
          <div className="md:col-span-1 space-y-6 bg-neutral-900 p-6 rounded-xl border border-neutral-800 h-fit">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <span className="text-xl">⚙️</span> Configuración
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Google API Key</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Modelo</label>
                <select 
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors text-white"
                >
                  <option value="gemini-3.1-flash-tts-preview">Gemini 3.1 Flash TTS (Preview)</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Estable)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Contexto (Sample Context)</label>
                <textarea 
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Escena (Scene)</label>
                <textarea 
                  value={scene}
                  onChange={(e) => setScene(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Voz (Speaker)</label>
                <input 
                  type="text" 
                  value={speaker}
                  onChange={(e) => setSpeaker(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Fragmentos */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="text-xl">📝</span> Fragmentos de Texto
              </h2>
              <button 
                onClick={handleGenerateAll}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
              >
                🚀 Generar Todo
              </button>
            </div>

            <div className="space-y-6">
              {fragments.map((fragment, index) => (
                <div key={fragment.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden transition-all hover:border-neutral-700">
                  <div className="bg-neutral-950/50 px-4 py-3 border-b border-neutral-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500 font-mono text-sm">{index + 1}.</span>
                      <input
                        type="text"
                        value={fragment.name}
                        onChange={(e) => handleUpdateName(index, e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-neutral-300 font-medium p-0 w-48 hover:bg-white/5 rounded px-2 transition-colors"
                        placeholder="Nombre del fragmento"
                      />
                    </div>
                    {fragments.length > 1 && (
                      <button 
                        onClick={() => handleRemoveFragment(index)}
                        className="text-red-400 hover:text-red-300 text-sm transition-colors"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  
                  <div className="p-4 space-y-4">
                    <textarea 
                      placeholder="Pega tu texto aquí..."
                      value={fragment.text}
                      onChange={(e) => handleUpdateText(index, e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors h-32 resize-y"
                    />

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <button 
                        onClick={() => handleGenerate(index)}
                        disabled={fragment.loading || !fragment.text.trim()}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                          fragment.loading 
                            ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" 
                            : "bg-neutral-800 hover:bg-neutral-700 text-white"
                        }`}
                      >
                        {fragment.loading ? "⏳ Generando..." : "▶️ Generar Audio"}
                      </button>

                      {fragment.error && (
                        <span className="text-red-400 text-sm truncate" title={fragment.error}>
                          ⚠️ {fragment.error}
                        </span>
                      )}

                        {fragment.resultUrl && (
                        <div className="flex-1 flex items-center justify-end gap-3 w-full">
                          <audio controls src={fragment.resultUrl} className="h-10 w-full max-w-[300px]" />
                          <a 
                            href={fragment.resultUrl} 
                            download={`${fragment.name || `fragmento_${index + 1}`}.wav`}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg transition-colors flex-shrink-0"
                            title="Descargar WAV"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={handleAddFragment}
              className="w-full py-4 border-2 border-dashed border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-neutral-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">+</span> Añadir otra ventana
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
