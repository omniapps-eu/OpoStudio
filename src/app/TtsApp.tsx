"use client";

import { useState, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import lamejs from "@breezystack/lamejs";

export default function TtsApp() {
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("gemini-3.1-flash-tts-preview");
  const [context, setContext] = useState("HABLA CON ACENTO CASTELLANO DE ESPAÑA. Premium commercial. Tone is polished, persuasive, and inviting. Comportate como un guia turístico que lleva a un grupo y que cobrará en función de como entusiasme al grupo, asi que intenta envaucarlos en cada parada.");
  const [scene, setScene] = useState("The Sound Stage Booth.");
  const [speaker, setSpeaker] = useState("Orus (Firm, Lower middle pitch).");
  
  const [fragments, setFragments] = useState([{ id: Date.now(), name: "Fragmento 1", text: "", resultUrl: "", loading: false, error: "" }]);

  // Importador de visita guiada
  const [importText, setImportText] = useState("");
  const [detectedStops, setDetectedStops] = useState<{ title: string; body: string }[] | null>(null);
  const [confirmedCount, setConfirmedCount] = useState<number | "">("");
  const [isDragging, setIsDragging] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  // Collapsible sections
  const [openPresentacion, setOpenPresentacion] = useState(true);
  const [openVoz, setOpenVoz] = useState(false);

  // Cargar configuración guardada al iniciar
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tts_config");
      if (saved) {
        try {
          const config = JSON.parse(saved);
          if (config.apiKey !== undefined) setApiKey(config.apiKey);
          if (config.modelName !== undefined) setModelName(config.modelName);
          if (config.context !== undefined) setContext(config.context);
          if (config.scene !== undefined) setScene(config.scene);
          if (config.speaker !== undefined) setSpeaker(config.speaker);
        } catch (e) {
          console.error("Error al cargar la configuración guardada:", e);
        }
      }
    }
  }, []);

  const handleSaveConfig = () => {
    const config = { apiKey, modelName, context, scene, speaker };
    localStorage.setItem("tts_config", JSON.stringify(config));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  };

  // Divide el texto por una línea horizontal de guiones (3+ "-", "_", "*", "—", "–")
  const parseStops = (raw: string) => {
    const normalized = raw.replace(/\r\n/g, "\n");
    const sections = normalized.split(/\n[ \t]*[=\-_*–—]{3,}[ \t]*\n/);
    return sections
      .map(s => s.replace(/^\n+|\n+$/g, ""))
      .filter(s => s.trim().length > 0)
      .map(section => {
        const lines = section.split("\n");
        let titleIdx = lines.findIndex(l => l.trim().length > 0);
        if (titleIdx === -1) titleIdx = 0;
        const title = lines[titleIdx].trim();
        const body = lines.slice(titleIdx + 1).join("\n").replace(/^\n+/, "");
        return { title, body };
      });
  };

  const ingestImportText = (text: string) => {
    setImportText(text);
    const stops = parseStops(text);
    setDetectedStops(stops);
    setConfirmedCount(stops.length);
  };

  const handleFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      ingestImportText(text);
    };
    reader.readAsText(file, "utf-8");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleApplyStops = () => {
    if (!detectedStops || detectedStops.length === 0) {
      alert("No se detectaron paradas. Verifica que estén separadas por una línea horizontal (---).");
      return;
    }
    const target = typeof confirmedCount === "number" ? confirmedCount : detectedStops.length;
    if (target !== detectedStops.length) {
      const ok = confirm(
        `⚠️ El número indicado (${target}) no coincide con las paradas detectadas (${detectedStops.length}).\n\n¿Continuar usando las ${detectedStops.length} paradas detectadas?`
      );
      if (!ok) return;
    }
    const now = Date.now();
    const newFragments = detectedStops.map((s, i) => ({
      id: now + i,
      name: s.title || `Parada ${i + 1}`,
      text: s.body,
      resultUrl: "",
      loading: false,
      error: ""
    }));
    setFragments(newFragments);
    setDetectedStops(null);
    setImportText("");
    setConfirmedCount("");
  };

  const handleClearAll = () => {
    if (!confirm("¿Borrar todos los fragmentos y empezar de cero?")) return;
    setFragments([{ id: Date.now(), name: "Fragmento 1", text: "", resultUrl: "", loading: false, error: "" }]);
    setImportText("");
    setDetectedStops(null);
    setConfirmedCount("");
  };

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

  // Convierte PCM L16 mono crudo (string binario) a MP3
  const pcmToMp3Blob = (rawPCM: string, sampleRate: number = 24000, kbps: number = 128): Blob => {
    const samples = new Int16Array(rawPCM.length / 2);
    for (let i = 0; i < samples.length; i++) {
      const lo = rawPCM.charCodeAt(i * 2);
      const hi = rawPCM.charCodeAt(i * 2 + 1);
      samples[i] = (hi << 8) | lo;
      if (samples[i] >= 0x8000) samples[i] -= 0x10000;
    }
    const encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
    const blockSize = 1152;
    const mp3Chunks: any[] = [];
    for (let i = 0; i < samples.length; i += blockSize) {
      const chunk = samples.subarray(i, i + blockSize);
      const mp3buf = encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) mp3Chunks.push(new Uint8Array(mp3buf));
    }
    const end = encoder.flush();
    if (end.length > 0) mp3Chunks.push(new Uint8Array(end));
    return new Blob(mp3Chunks, { type: 'audio/mpeg' });
  };

  const handleGenerate = async (index: number) => {
    const fragment = fragments[index];
    if (!fragment.text.trim()) {
      alert("Por favor introduce texto");
      return;
    }

    // Update state to loading (functional para que sea seguro en paralelo)
    setFragments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], loading: true, error: "", resultUrl: "" };
      return updated;
    });

    try {
      
      // Dividimos el texto en párrafos para evitar el fade-out del modelo
      const chunks = fragment.text.split('\n').filter(p => p.trim().length > 0);
      let totalRawPCM = "";

      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        console.log(`Procesando chunk ${i + 1}/${chunks.length}...`);

        const payload: any = {
          contents: [{ 
            role: "user", 
            parts: [{ 
              text: `Scene: ${scene} Context: ${context} Speaker: ${speaker}\n\nTexto a convertir: ${chunkText}` 
            }] 
          }],
          generationConfig: {
            response_modalities: ["AUDIO"],
            temperature: 1.0
          }
        };

        if (modelName.includes("tts")) {
          payload.generationConfig.speech_config = {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: speaker.split(' ')[0]
              }
            }
          };
        }

        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelName,
            payload,
            apiKey: apiKey || undefined
          })
        });

        if (!response.ok) {
          let errorMsg = `Error en chunk ${i + 1}: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMsg = errorData.error?.message || errorMsg;
          } catch (_) {
            try {
              const text = await response.text();
              errorMsg = text.slice(0, 150) || errorMsg;
            } catch (_) {}
          }
          throw new Error(errorMsg);
        }

        let data;
        try {
          data = await response.json();
        } catch (e: any) {
          throw new Error(`La respuesta de /api/generate no es un JSON válido (Código ${response.status}).`);
        }
        const candidate = data.candidates?.[0];
        
        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
          console.warn(`Chunk ${i + 1} terminó con razón: ${candidate.finishReason}`);
        }

        let chunkBase64 = "";
        const parts = candidate?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            chunkBase64 = part.inlineData.data;
            break;
          }
        }

        if (chunkBase64) {
          // Decodificamos de base64 a binario "crudo" para concatenar
          totalRawPCM += atob(chunkBase64);
        }
      }

      if (totalRawPCM) {
        console.log("Generación completada. Concatenando y añadiendo cabecera WAV...");
        
        // Convertimos PCM crudo a MP3
        const mp3Blob = pcmToMp3Blob(totalRawPCM, 24000, 128);
        const finalAudioUrl = URL.createObjectURL(mp3Blob);

        setFragments(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], loading: false, resultUrl: finalAudioUrl };
          return updated;
        });
      } else {
        throw new Error("No se pudo generar audio para ningún fragmento del texto.");
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

  // Genera todos los fragmentos pendientes en lotes de 2 en paralelo
  const handleGenerateBatch = async () => {
    if (batchRunning) return;
    const pending: number[] = [];
    fragments.forEach((f, i) => {
      if (f.text.trim() && !f.resultUrl) pending.push(i);
    });
    if (pending.length === 0) return;
    setBatchRunning(true);
    const CONCURRENCY = 2;
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
      while (cursor < pending.length) {
        const myIdx = pending[cursor++];
        try {
          await handleGenerate(myIdx);
        } catch (e) {
          // handleGenerate ya gestiona errores en estado
        }
      }
    });
    await Promise.all(workers);
    setBatchRunning(false);
  };

  const handleRemoveFragment = (index: number) => {
    if (fragments.length > 1) {
      setFragments(fragments.filter((_, i) => i !== index));
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#2d2b2a] p-8 font-sans">
      <div className="max-w-[96%] xl:max-w-[1600px] mx-auto space-y-8">
        
        <header className="border-b border-[#e8e7e0] pb-6 flex items-center gap-4">
          <img src="/logo.png" alt="OpoStudio Logo" className="w-14 h-14 object-contain rounded-xl shadow-sm border border-[#e8e7e0]/50" />
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              OpoStudio · Voz
            </h1>
            <p className="text-[#6e6b64] font-medium mt-1">Generador de audio con Next.js + Tailwind</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Configuración */}
          <div className="lg:col-span-5 space-y-6 bg-[#f9f8f5] p-6 rounded-xl border border-[#e8e7e0] shadow-sm h-fit">
            <h2 className="text-xl font-bold text-[#2d2b2a] flex items-center gap-2">
              <span className="text-xl">⚙️</span> Configuración
            </h2>
            
            <div className="space-y-4">
              {/* Sección 1: Presentación */}
              <div className="bg-white border border-[#e8e7e0] rounded-xl overflow-hidden shadow-sm transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setOpenPresentacion(!openPresentacion)}
                  className="w-full px-5 py-4 flex items-center justify-between bg-[#fcfbfa] hover:bg-[#f6f5f2] border-b border-[#e8e7e0] transition-colors"
                >
                  <span className="font-bold text-sm text-[#2d2b2a] flex items-center gap-2">
                    <span>📊</span> Presentación
                  </span>
                  <span className="text-xs text-[#6e6b64] font-bold">
                    {openPresentacion ? "Ocultar ▲" : "Mostrar ▼"}
                  </span>
                </button>
                {openPresentacion && (
                  <div className="p-4 space-y-4 bg-white animate-fadeIn">
                    <div>
                      <label className="block text-xs font-bold text-[#5c5952] uppercase tracking-wider mb-1.5">
                        Modelo de Voz
                      </label>
                      <select 
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors text-sm"
                      >
                        <option value="gemini-3.1-flash-tts-preview">Gemini 3.1 Flash TTS (Preview)</option>
                        <option value="gemini-2.5-flash-preview-tts">Gemini 2.5 Flash TTS (Preview)</option>
                        <option value="gemini-2.5-pro-preview-tts">Gemini 2.5 Pro TTS (Preview)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Sección 2: Generador de voz */}
              <div className="bg-white border border-[#e8e7e0] rounded-xl overflow-hidden shadow-sm transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setOpenVoz(!openVoz)}
                  className="w-full px-5 py-4 flex items-center justify-between bg-[#fcfbfa] hover:bg-[#f6f5f2] border-b border-[#e8e7e0] transition-colors"
                >
                  <span className="font-bold text-sm text-[#2d2b2a] flex items-center gap-2">
                    <span>🎙️</span> Generador de voz
                  </span>
                  <span className="text-xs text-[#6e6b64] font-bold">
                    {openVoz ? "Ocultar ▲" : "Mostrar ▼"}
                  </span>
                </button>
                {openVoz && (
                  <div className="p-4 space-y-4 bg-white animate-fadeIn">
                    <div>
                      <label className="block text-xs font-bold text-[#5c5952] uppercase tracking-wider mb-1.5">
                        Voz (Speaker)
                      </label>
                      <input 
                        type="text" 
                        value={speaker}
                        onChange={(e) => setSpeaker(e.target.value)}
                        className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5c5952] uppercase tracking-wider mb-1.5">
                        Contexto (Sample Context)
                      </label>
                      <textarea 
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors h-20 resize-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5c5952] uppercase tracking-wider mb-1.5">
                        Escena (Scene)
                      </label>
                      <textarea 
                        value={scene}
                        onChange={(e) => setScene(e.target.value)}
                        className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors h-20 resize-none text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveConfig}
                  className={`w-full py-2.5 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    saveStatus === "saved"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/10"
                      : "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/10"
                  }`}
                >
                  {saveStatus === "saved" ? "✅ ¡Guardado!" : "💾 Guardar config"}
                </button>
              </div>
            </div>
          </div>

          {/* Fragmentos */}
          <div className="lg:col-span-7 space-y-6">

            {/* Importador de visita guiada */}
            <div className="bg-[#f9f8f5] border border-[#e8e7e0] rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-[#2d2b2a] flex items-center gap-2">
                <span className="text-xl">🗺️</span> Importar visita guiada
              </h2>
              <p className="text-sm text-[#6e6b64] font-medium">
                Arrastra un archivo <code className="text-[#2d2b2a] font-semibold">.txt</code> o pega el texto. Separa cada parada con una línea horizontal (<code className="text-[#2d2b2a] font-semibold">===</code> o <code className="text-[#2d2b2a] font-semibold">---</code>). La primera línea de cada parada se usará como título del fragmento.
              </p>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging ? "border-violet-600 bg-violet-50" : "border-[#d5d3c9] hover:border-neutral-400 bg-white"
                }`}
              >
                <p className="text-[#6e6b64] font-medium">📂 Arrastra aquí un .txt o haz click para seleccionar</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              <textarea
                placeholder="...o pega aquí el texto de la visita"
                value={importText}
                onChange={(e) => ingestImportText(e.target.value)}
                className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-3 focus:outline-none focus:border-violet-500 transition-colors h-32 resize-y text-sm shadow-inner"
              />

              {detectedStops && (
                <div className="bg-white border border-[#e8e7e0] rounded-lg p-4 space-y-3 shadow-inner">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[#2d2b2a] text-sm">
                      Paradas detectadas: <strong className="text-emerald-700">{detectedStops.length}</strong>
                    </span>
                    <label className="text-sm text-[#6e6b64] flex items-center gap-2 font-medium">
                      ¿Cuántas paradas tiene?
                      <input
                        type="number"
                        min={1}
                        value={confirmedCount}
                        onChange={(e) => setConfirmedCount(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-white border border-[#d5d3c9] rounded px-2 py-1 text-[#2d2b2a]"
                      />
                    </label>
                  </div>
                  {detectedStops.length > 0 && (
                    <ul className="text-xs text-[#6e6b64] list-decimal list-inside space-y-1 max-h-32 overflow-auto font-mono">
                      {detectedStops.map((s, i) => (
                        <li key={i}><span className="text-[#2d2b2a] font-sans font-semibold">{s.title || `(sin título)`}</span></li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handleApplyStops}
                      className="bg-[#2d2b2a] hover:bg-black text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-md transition-colors"
                    >
                      ✅ Crear fragmentos
                    </button>
                    <button
                      onClick={() => ingestImportText(importText)}
                      className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700 border border-[#d5d3c9] px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                      title="Volver a analizar el texto actual"
                    >
                      🔄 Redetectar paradas
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold text-[#2d2b2a] flex items-center gap-2">
                <span>📝</span> Fragmentos de Texto
              </h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleClearAll}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-md shadow-red-500/10 transition-colors"
                >
                  🗑️ Borrar todo
                </button>
                <button
                  onClick={handleGenerateBatch}
                  disabled={batchRunning}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-md ${
                    batchRunning
                      ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/10"
                  }`}
                >
                  {batchRunning ? "⏳ Generando (2x)..." : "🎙️ Generar visita (de 2 en 2)"}
                </button>
                <button
                  onClick={handleGenerateAll}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold text-sm transition-colors shadow-md shadow-blue-500/10"
                >
                  🚀 Generar Todo
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {fragments.map((fragment, index) => (
                <div
                  key={fragment.id}
                  className={`bg-[#f9f8f5] border rounded-xl overflow-hidden transition-all shadow-sm ${
                    fragment.resultUrl
                      ? "border-emerald-600/30 bg-emerald-50/10"
                      : fragment.error
                      ? "border-red-600/30 bg-red-50/10"
                      : "border-[#e8e7e0] hover:border-neutral-300"
                  }`}
                >
                  <div className="bg-white px-4 py-3 border-b border-[#e8e7e0] flex justify-between items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-[#6e6b64] font-mono text-sm font-semibold flex-shrink-0">{index + 1}.</span>
                      <input
                        type="text"
                        value={fragment.name}
                        onChange={(e) => handleUpdateName(index, e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-[#2d2b2a] font-bold p-0 flex-1 min-w-0 hover:bg-black/5 rounded px-2 transition-colors text-sm"
                        placeholder="Nombre del fragmento"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs flex-shrink-0">
                        {fragment.resultUrl ? (
                          <span className="text-emerald-700 font-semibold">✅ listo</span>
                        ) : fragment.loading ? (
                          <span className="text-amber-700 animate-pulse font-semibold">⏳ generando…</span>
                        ) : fragment.error ? (
                          <span className="text-red-700 font-semibold">⚠️ error</span>
                        ) : (
                          <span className="text-[#a8a59a]">— pendiente</span>
                        )}
                      </span>
                      {fragments.length > 1 && (
                        <button 
                          onClick={() => handleRemoveFragment(index)}
                          className="text-red-600 hover:text-red-700 text-sm font-semibold transition-colors"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    <textarea 
                      placeholder="Pega tu texto aquí..."
                      value={fragment.text}
                      onChange={(e) => handleUpdateText(index, e.target.value)}
                      className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-3 focus:outline-none focus:border-violet-500 transition-colors h-32 resize-y text-sm shadow-inner"
                    />

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <button 
                        onClick={() => handleGenerate(index)}
                        disabled={fragment.loading || !fragment.text.trim()}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap text-sm ${
                          fragment.loading 
                            ? "bg-neutral-200 text-neutral-400 cursor-not-allowed" 
                            : "bg-neutral-200 hover:bg-neutral-300 text-neutral-700 border border-[#d5d3c9]"
                        }`}
                      >
                        {fragment.loading ? "⏳ Generando..." : fragment.resultUrl ? "🔄 Regenerar" : "▶️ Generar Audio"}
                      </button>

                      {fragment.error && (
                        <span className="text-red-700 font-semibold text-sm truncate flex-1" title={fragment.error}>
                          ⚠️ {fragment.error}
                        </span>
                      )}

                      {fragment.resultUrl && (
                        <div className="flex-1 flex items-center justify-end gap-3 w-full">
                          <audio controls src={fragment.resultUrl} className="h-9 w-full max-w-[300px]" />
                          <a 
                            href={fragment.resultUrl} 
                            download={`${fragment.name || `fragmento_${index + 1}`}.mp3`}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition-all flex-shrink-0 shadow-md shadow-emerald-500/10"
                            title="Descargar MP3"
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
              className="w-full py-4 border-2 border-dashed border-[#d5d3c9] hover:border-neutral-400 bg-white text-[#6e6b64] hover:text-[#2d2b2a] rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="text-xl">+</span> Añadir otra ventana
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
