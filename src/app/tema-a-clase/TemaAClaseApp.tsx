"use client";

import { useState, useRef, useEffect } from "react";
import lamejs from "@breezystack/lamejs";
import { DEFAULT_SYSTEM_PROMPT } from "./prompt";

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
}

type Fragment = {
  id: number;
  name: string;
  text: string;
  resultUrl: string;
  resultBlob: Blob | null;
  loading: boolean;
  error: string;
};

type Step = "config" | "generating" | "editing";

export default function TemaAClaseApp() {
  // Config
  const [apiKey, setApiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [scriptModel, setScriptModel] = useState("gemini-2.5-flash");
  const [ttsModel, setTtsModel] = useState("gemini-2.5-flash-preview-tts");
  const [ttsContext, setTtsContext] = useState(
    "HABLA CON ACENTO CASTELLANO DE ESPAÑA. Eres un preparador de oposiciones experto y cercano. Tono didáctico y motivador."
  );
  const [ttsScene, setTtsScene] = useState("The Sound Stage Booth.");
  const [ttsSpeaker, setTtsSpeaker] = useState("Orus");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  // Collapsible sections
  const [openPresentacion, setOpenPresentacion] = useState(true);
  const [openVoz, setOpenVoz] = useState(false);
  const [openInstrucciones, setOpenInstrucciones] = useState(false);

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pipeline
  const [step, setStep] = useState<Step>("config");
  const [scriptError, setScriptError] = useState("");
  const [scriptHtml, setScriptHtml] = useState("");
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Directory selection & real-time auto-saving
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  useEffect(() => {
    directoryHandleRef.current = directoryHandle;
  }, [directoryHandle]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("tac_config");
    if (!saved) return;
    try {
      const c = JSON.parse(saved);
      setTimeout(() => {
        if (c.apiKey !== undefined) setApiKey(c.apiKey);
        if (c.systemPrompt !== undefined) setSystemPrompt(c.systemPrompt);
        if (c.scriptModel !== undefined) setScriptModel(c.scriptModel);
        if (c.ttsModel !== undefined) setTtsModel(c.ttsModel);
        if (c.ttsContext !== undefined) setTtsContext(c.ttsContext);
        if (c.ttsScene !== undefined) setTtsScene(c.ttsScene);
        if (c.ttsSpeaker !== undefined) setTtsSpeaker(c.ttsSpeaker);
      }, 0);
    } catch {}
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem(
      "tac_config",
      JSON.stringify({ apiKey, systemPrompt, scriptModel, ttsModel, ttsContext, ttsScene, ttsSpeaker })
    );
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  };

  // PDF handling
  const handlePdfFile = (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Por favor sube un archivo PDF.");
      return;
    }
    setPdfFile(file);
    setSavedOk(false);
    setScriptError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfFile(file);
  };

  // Parse TXT sections (same logic as TtsApp)
  const parseStops = (raw: string) => {
    const normalized = raw.replace(/\r\n/g, "\n");
    const sections = normalized.split(/\n[ \t]*[=\-_*–—]{3,}[ \t]*\n/);
    return sections
      .map((s) => s.replace(/^\n+|\n+$/g, ""))
      .filter((s) => s.trim().length > 0)
      .map((section) => {
        const lines = section.split("\n");
        let titleIdx = lines.findIndex((l) => l.trim().length > 0);
        if (titleIdx === -1) titleIdx = 0;
        const title = lines[titleIdx].trim();
        const body = lines
          .slice(titleIdx + 1)
          .join("\n")
          .replace(/^\n+/, "");
        return { title, body };
      });
  };

  // Generate script from PDF via Gemini 2.5 Pro
  const handleGenerateScript = async () => {
    if (!pdfFile) return;
    setStep("generating");
    setScriptError("");
    setSavedOk(false);

    try {
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(pdfFile);
      });

      const response = await fetch("/api/tema/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64, systemPrompt, model: scriptModel, apiKey: apiKey || undefined }),
      });

      if (!response.ok) {
        let errorMsg = `Error al generar el guion: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error?.message || errorMsg;
        } catch {
          try {
            const text = await response.text();
            errorMsg = text.slice(0, 150) || errorMsg;
          } catch {}
        }
        throw new Error(errorMsg);
      }

      let data: { txt: string; html: string };
      try {
        data = await response.json() as { txt: string; html: string };
      } catch {
        throw new Error(`La respuesta de /api/tema/script no es un JSON válido (Código ${response.status}).`);
      }

      const { txt, html } = data;
      const stops = parseStops(txt);
      const now = Date.now();
      setFragments(
        stops.map((s, i) => ({
          id: now + i,
          name: s.title,
          text: s.body,
          resultUrl: "",
          resultBlob: null,
          loading: false,
          error: "",
        }))
      );
      setScriptHtml(html);
      setStep("editing");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error al generar el material.";
      setScriptError(errMsg);
      setStep("config");
    }
  };

  // PCM L16 mono → MP3 Blob
  const pcmToMp3Blob = (rawPCM: string, sampleRate = 24000, kbps = 128): Blob => {
    const samples = new Int16Array(rawPCM.length / 2);
    for (let i = 0; i < samples.length; i++) {
      const lo = rawPCM.charCodeAt(i * 2);
      const hi = rawPCM.charCodeAt(i * 2 + 1);
      samples[i] = (hi << 8) | lo;
      if (samples[i] >= 0x8000) samples[i] -= 0x10000;
    }
    const encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
    const blockSize = 1152;
    const mp3Chunks: Uint8Array[] = [];
    for (let i = 0; i < samples.length; i += blockSize) {
      const chunk = samples.subarray(i, i + blockSize);
      const mp3buf = encoder.encodeBuffer(chunk);
      if (mp3buf && (mp3buf as { length: number }).length > 0) {
        mp3Chunks.push(new Uint8Array(mp3buf as ArrayLike<number>));
      }
    }
    const end = encoder.flush();
    if (end && (end as { length: number }).length > 0) {
      mp3Chunks.push(new Uint8Array(end as ArrayLike<number>));
    }
    return new Blob(mp3Chunks as unknown as BlobPart[], { type: "audio/mpeg" });
  };

  // Helper to save a single MP3, TXT and update index.html in the linked directory
  const autoSaveSingleAudioAndHtml = async (
    dirHandle: FileSystemDirectoryHandle,
    updatedFragments: Fragment[],
    completedIndex: number,
    blob: Blob
  ) => {
    try {
      const fragment = updatedFragments[completedIndex];
      const filename = sanitizeFilename(fragment.name) + ".mp3";

      // Write the MP3 file
      const mp3Handle = await dirHandle.getFileHandle(filename, { create: true });
      const mp3Writable = await mp3Handle.createWritable();
      await mp3Writable.write(blob);
      await mp3Writable.close();

      // Write the individual TXT file for this fragment
      const txtFilename = sanitizeFilename(fragment.name) + ".txt";
      const txtHandle = await dirHandle.getFileHandle(txtFilename, { create: true });
      const txtWritable = await txtHandle.createWritable();
      await txtWritable.write(new Blob([fragment.text], { type: "text/plain;charset=utf-8" }));
      await txtWritable.close();

      // Re-generate and write the full guion.txt script file
      const fullTxt = updatedFragments
        .map((f) => `${f.name}\n${f.text}`)
        .join("\n\n===================================================\n\n");
      const combinedTxtHandle = await dirHandle.getFileHandle("guion.txt", { create: true });
      const combinedTxtWritable = await combinedTxtHandle.createWritable();
      await combinedTxtWritable.write(new Blob([fullTxt], { type: "text/plain;charset=utf-8" }));
      await combinedTxtWritable.close();

      // Write the updated HTML presentation
      const patchedHtml = patchHtmlSrcs(scriptHtml, updatedFragments);
      const htmlHandle = await dirHandle.getFileHandle("index.html", { create: true });
      const htmlWritable = await htmlHandle.createWritable();
      await htmlWritable.write(new Blob([patchedHtml], { type: "text/html;charset=utf-8" }));
      await htmlWritable.close();
    } catch (err: unknown) {
      console.error("Error al auto-guardar archivo en la carpeta vinculada:", err);
    }
  };

  // Generate TTS for one fragment
  const handleGenerate = async (index: number) => {
    const fragment = fragments[index];
    if (!fragment.text.trim()) return;

    setFragments((prev) => {
      const u = [...prev];
      u[index] = { ...u[index], loading: true, error: "", resultUrl: "", resultBlob: null };
      return u;
    });

    try {
      const chunks = fragment.text.split("\n").filter((p) => p.trim().length > 0);
      let totalRawPCM = "";

      for (const chunkText of chunks) {
        const payload = {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Scene: ${ttsScene} Context: ${ttsContext} Speaker: ${ttsSpeaker}\n\nTexto a convertir: ${chunkText}`,
                },
              ],
            },
          ],
          generationConfig: {
            response_modalities: ["AUDIO"],
            temperature: 1.0,
            speech_config: {
              voice_config: {
                prebuilt_voice_config: { voice_name: ttsSpeaker.split(" ")[0] },
              },
            },
          },
        };

        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelName: ttsModel, payload, apiKey: apiKey || undefined }),
        });

        if (!response.ok) {
          let errorMsg = `Error en epígrafe ${index + 1}: ${response.status}`;
          try {
            const errorData = await response.json() as { error?: { message?: string } };
            errorMsg = errorData.error?.message || errorMsg;
          } catch {
            try {
              const text = await response.text();
              errorMsg = text.slice(0, 150) || errorMsg;
            } catch {}
          }
          throw new Error(errorMsg);
        }

        let data: { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> };
        try {
          data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> };
        } catch {
          throw new Error(`La respuesta de /api/generate no es un JSON válido (Código ${response.status}).`);
        }
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            totalRawPCM += atob(part.inlineData.data);
            break;
          }
        }
      }

      if (!totalRawPCM) throw new Error("No se generó audio.");

      const mp3Blob = pcmToMp3Blob(totalRawPCM);
      const resultUrl = URL.createObjectURL(mp3Blob);

      setFragments((prev) => {
        const u = [...prev];
        u[index] = { ...u[index], loading: false, resultUrl, resultBlob: mp3Blob };
        return u;
      });

      if (directoryHandleRef.current) {
        const updatedFragments = fragments.map((f, i) =>
          i === index ? { ...f, loading: false, resultUrl, resultBlob: mp3Blob } : f
        );
        await autoSaveSingleAudioAndHtml(directoryHandleRef.current, updatedFragments, index, mp3Blob);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error desconocido.";
      setFragments((prev) => {
        const u = [...prev];
        u[index] = { ...u[index], loading: false, error: errMsg };
        return u;
      });
    }
  };

  // Batch TTS 1-by-1
  const handleGenerateBatch = async () => {
    if (batchRunning) return;
    const pending = fragments
      .map((f, i) => i)
      .filter((i) => fragments[i].text.trim() && !fragments[i].resultUrl && !fragments[i].loading);
    if (pending.length === 0) return;

    setBatchRunning(true);
    const CONCURRENCY = 1;
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
        while (cursor < pending.length) {
          const idx = pending[cursor++];
          await handleGenerate(idx).catch(() => {});
        }
      })
    );
    setBatchRunning(false);
  };

  // Sanitize filename for Windows (no colons, no special chars)
  const sanitizeFilename = (name: string) =>
    name.replace(/:/g, "_").replace(/[<>"|?*\\/]/g, "_").trim();

  // Patch all <source src="...mp3"> in the HTML with actual sanitized filenames, in order
  const patchHtmlSrcs = (html: string, frags: Fragment[]): string => {
    let idx = 0;
    return html.replace(/<source\s+src="[^"]*\.mp3"/gi, () => {
      const filename =
        idx < frags.length ? sanitizeFilename(frags[idx].name) + ".mp3" : `audio_${idx}.mp3`;
      idx++;
      return `<source src="${filename}"`;
    });
  };

  // Helper to save all current assets (HTML + MP3s + TXTs) to a folder
  const autoSaveAllToDirectory = async (dirHandle: FileSystemDirectoryHandle, frags: Fragment[]) => {
    // Write HTML with patched src attributes
    const patchedHtml = patchHtmlSrcs(scriptHtml, frags);
    const htmlHandle = await dirHandle.getFileHandle("index.html", { create: true });
    const htmlWritable = await htmlHandle.createWritable();
    await htmlWritable.write(new Blob([patchedHtml], { type: "text/html;charset=utf-8" }));
    await htmlWritable.close();

    // Write combined guion.txt script file
    const fullTxt = frags
      .map((f) => `${f.name}\n${f.text}`)
      .join("\n\n===================================================\n\n");
    const combinedTxtHandle = await dirHandle.getFileHandle("guion.txt", { create: true });
    const combinedTxtWritable = await combinedTxtHandle.createWritable();
    await combinedTxtWritable.write(new Blob([fullTxt], { type: "text/plain;charset=utf-8" }));
    await combinedTxtWritable.close();

    // Write each completed MP3 and individual TXT
    for (const fragment of frags) {
      // Write the TXT file regardless of whether MP3 exists
      const txtFilename = sanitizeFilename(fragment.name) + ".txt";
      const txtHandle = await dirHandle.getFileHandle(txtFilename, { create: true });
      const txtWritable = await txtHandle.createWritable();
      await txtWritable.write(new Blob([fragment.text], { type: "text/plain;charset=utf-8" }));
      await txtWritable.close();

      if (!fragment.resultBlob) continue;
      const filename = sanitizeFilename(fragment.name) + ".mp3";
      const mp3Handle = await dirHandle.getFileHandle(filename, { create: true });
      const mp3Writable = await mp3Handle.createWritable();
      await mp3Writable.write(fragment.resultBlob);
      await mp3Writable.close();
    }
  };

  // Choose a local directory using the File System Access API and save initial files
  const handleChooseDirectory = async () => {
    setSaving(true);
    try {
      const win = window as unknown as WindowWithDirectoryPicker;
      if (!win.showDirectoryPicker) {
        throw new Error("Su navegador no soporta la API de Acceso al Sistema de Archivos.");
      }
      const dirHandle = await win.showDirectoryPicker({ mode: "readwrite" });
      setDirectoryHandle(dirHandle);

      // Save everything we have so far
      await autoSaveAllToDirectory(dirHandle, fragments);
      setSavedOk(true);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== "AbortError") {
        alert(`Error al vincular carpeta: ${error.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Save files to linked folder or prompt user if not linked
  const handleSaveToFolder = async () => {
    setSaving(true);
    try {
      let dirHandle = directoryHandle;
      if (!dirHandle) {
        const win = window as unknown as WindowWithDirectoryPicker;
        if (!win.showDirectoryPicker) {
          throw new Error("Su navegador no soporta la API de Acceso al Sistema de Archivos.");
        }
        dirHandle = await win.showDirectoryPicker({ mode: "readwrite" });
        setDirectoryHandle(dirHandle);
      }

      await autoSaveAllToDirectory(dirHandle, fragments);
      setSavedOk(true);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== "AbortError") {
        alert(`Error al guardar: ${error.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Helper to fetch a file from FileSystemDirectoryHandle, returns null if not found
  const getFileOrNull = async (dirHandle: FileSystemDirectoryHandle, filename: string): Promise<File | null> => {
    try {
      const handle = await dirHandle.getFileHandle(filename);
      return await handle.getFile();
    } catch {
      return null;
    }
  };

  // Recover state from a previously saved local directory
  const handleRecoverFromDirectory = async () => {
    setSaving(true);
    try {
      const win = window as unknown as WindowWithDirectoryPicker;
      if (!win.showDirectoryPicker) {
        throw new Error("Su navegador no soporta la API de Acceso al Sistema de Archivos.");
      }
      const dirHandle = await win.showDirectoryPicker({ mode: "readwrite" });

      const guionFile = await getFileOrNull(dirHandle, "guion.txt");
      if (!guionFile) {
        throw new Error("No se encontró el archivo 'guion.txt' en la carpeta seleccionada. Asegúrese de elegir una carpeta válida de una generación anterior.");
      }

      const txtContent = await guionFile.text();
      const stops = parseStops(txtContent);
      if (stops.length === 0) {
        throw new Error("El archivo 'guion.txt' está vacío o no tiene un formato válido.");
      }

      const htmlFile = await getFileOrNull(dirHandle, "index.html");
      if (htmlFile) {
        const htmlContent = await htmlFile.text();
        setScriptHtml(htmlContent);
      }

      const now = Date.now();
      const loadedFragments: Fragment[] = [];
      let audiosLoaded = 0;

      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        const mp3Filename = sanitizeFilename(s.title) + ".mp3";
        const mp3File = await getFileOrNull(dirHandle, mp3Filename);

        let resultBlob: Blob | null = null;
        let resultUrl = "";
        if (mp3File) {
          resultBlob = mp3File;
          resultUrl = URL.createObjectURL(mp3File);
          audiosLoaded++;
        }

        loadedFragments.push({
          id: now + i,
          name: s.title,
          text: s.body,
          resultUrl,
          resultBlob,
          loading: false,
          error: "",
        });
      }

      setFragments(loadedFragments);
      setDirectoryHandle(dirHandle);
      setStep("editing");
      setSavedOk(true);

      alert(`🎉 ¡Progreso recuperado con éxito!\nSe cargaron ${audiosLoaded} audios de ${loadedFragments.length} epígrafes desde la carpeta.`);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== "AbortError") {
        alert(`Error al recuperar progreso: ${error.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Preview generated HTML presentation in a new tab
  const handlePreviewPresentation = () => {
    if (!scriptHtml) {
      alert("No hay presentación disponible para previsualizar.");
      return;
    }
    const blob = new Blob([scriptHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const allHaveAudio = fragments.length > 0 && fragments.every((f) => !!f.resultBlob);
  const pendingCount = fragments.filter(
    (f) => f.text.trim() && !f.resultUrl && !f.loading
  ).length;
  const doneCount = fragments.filter((f) => !!f.resultBlob).length;

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#2d2b2a] p-8 font-sans">
      <div className="max-w-[96%] xl:max-w-[1600px] mx-auto space-y-8">
        <header className="border-b border-[#e8e7e0] pb-6 flex items-center gap-4">
          <img src="/logo.png" alt="OpoStudio Logo" className="w-14 h-14 object-contain rounded-xl shadow-sm border border-[#e8e7e0]/50" />
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              OpoStudio
            </h1>
            <p className="text-[#6e6b64] font-medium mt-1">
              Generador de Material Didáctico con Audio a partir de PDF
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ── Left: Config panel ── */}
          <div className="lg:col-span-5 space-y-6 bg-[#f9f8f5] p-6 rounded-xl border border-[#e8e7e0] shadow-sm h-fit">
            <h2 className="text-xl font-bold text-[#2d2b2a] flex items-center gap-2">
              <span>⚙️</span> Configuración
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
                        Modelo de Guion
                      </label>
                      <select
                        value={scriptModel}
                        onChange={(e) => setScriptModel(e.target.value)}
                        className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors text-sm"
                      >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Gratuito / Rápido)</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro (Requiere Pago)</option>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
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
                        Modelo TTS
                      </label>
                      <select
                        value={ttsModel}
                        onChange={(e) => setTtsModel(e.target.value)}
                        className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors text-sm"
                      >
                        <option value="gemini-2.5-flash-preview-tts">Gemini 2.5 Flash TTS</option>
                        <option value="gemini-2.5-pro-preview-tts">Gemini 2.5 Pro TTS</option>
                        <option value="gemini-3.1-flash-tts-preview">Gemini 3.1 Flash TTS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5c5952] uppercase tracking-wider mb-1.5">
                        Voz (Speaker)
                      </label>
                      <input
                        type="text"
                        value={ttsSpeaker}
                        onChange={(e) => setTtsSpeaker(e.target.value)}
                        className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5c5952] uppercase tracking-wider mb-1.5">
                        Contexto TTS
                      </label>
                      <textarea
                        value={ttsContext}
                        onChange={(e) => setTtsContext(e.target.value)}
                        className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors h-20 resize-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5c5952] uppercase tracking-wider mb-1.5">
                        Escena TTS
                      </label>
                      <input
                        type="text"
                        value={ttsScene}
                        onChange={(e) => setTtsScene(e.target.value)}
                        className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sección 3: Instrucciones del Agente */}
              <div className="bg-white border border-[#e8e7e0] rounded-xl overflow-hidden shadow-sm transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setOpenInstrucciones(!openInstrucciones)}
                  className="w-full px-5 py-4 flex items-center justify-between bg-[#fcfbfa] hover:bg-[#f6f5f2] border-b border-[#e8e7e0] transition-colors"
                >
                  <span className="font-bold text-sm text-[#2d2b2a] flex items-center gap-2">
                    <span>🧠</span> Instrucciones del Agente
                  </span>
                  <span className="text-xs text-[#6e6b64] font-bold">
                    {openInstrucciones ? "Ocultar ▲" : "Mostrar ▼"}
                  </span>
                </button>
                {openInstrucciones && (
                  <div className="p-4 bg-white animate-fadeIn">
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-3 focus:outline-none focus:border-violet-500 transition-colors h-64 resize-y text-xs font-mono"
                    />
                  </div>
                )}
              </div>

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

          {/* ── Right: Pipeline ── */}
          <div className="lg:col-span-7 space-y-6">
            {/* PDF upload — visible en config y editing */}
            <div className="bg-[#f9f8f5] border border-[#e8e7e0] rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-[#2d2b2a] flex items-center gap-2">
                <span>📄</span> PDF del tema
              </h2>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-violet-600 bg-violet-50"
                    : "border-[#d5d3c9] hover:border-neutral-400 bg-white"
                }`}
              >
                {pdfFile ? (
                  <div>
                    <p className="text-emerald-700 font-semibold">✅ {pdfFile.name}</p>
                    <p className="text-[#6e6b64] text-sm mt-1">
                      {(pdfFile.size / 1024 / 1024).toFixed(1)} MB · click para cambiar
                    </p>
                  </div>
                ) : (
                  <p className="text-[#6e6b64] font-medium">
                    📂 Arrastra el PDF aquí o haz click para seleccionar
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handlePdfFile(e.target.files[0])}
                />
              </div>

              {scriptError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm font-medium">
                  ⚠️ {scriptError}
                </div>
              )}

              {step === "config" && (
                <div className="space-y-3">
                  <button
                    onClick={handleGenerateScript}
                    disabled={!pdfFile}
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                      pdfFile
                        ? "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/10"
                        : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                    }`}
                  >
                    ✨ Generar guion y presentación con Gemini
                  </button>
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-[#e8e7e0]"></div>
                    <span className="flex-shrink mx-4 text-[#6e6b64] text-xs font-bold uppercase tracking-wider">O también</span>
                    <div className="flex-grow border-t border-[#e8e7e0]"></div>
                  </div>
                  <button
                    onClick={handleRecoverFromDirectory}
                    className="w-full py-2.5 px-6 rounded-lg font-bold text-sm transition-colors bg-white hover:bg-neutral-50 text-neutral-700 border border-[#d5d3c9] shadow-sm flex items-center justify-center gap-2"
                  >
                    📂 Recuperar progreso desde carpeta
                  </button>
                </div>
              )}

              {step === "editing" && (
                <button
                  onClick={handleGenerateScript}
                  disabled={!pdfFile}
                  className="w-full py-2 px-4 rounded-lg font-semibold text-sm bg-neutral-200 hover:bg-neutral-300 text-neutral-700 border border-[#d5d3c9] transition-colors"
                >
                  🔄 Regenerar desde este PDF
                </button>
              )}
            </div>

            {/* Loading */}
            {step === "generating" && (
              <div className="bg-[#f9f8f5] border border-[#e8e7e0] rounded-xl p-10 text-center shadow-sm space-y-4">
                <div className="text-4xl animate-pulse">🧠</div>
                <p className="text-[#2d2b2a] font-bold text-lg">
                  Gemini está leyendo el tema...
                </p>
                <p className="text-[#6e6b64] text-sm">
                  Generando guion de audio por epígrafes y presentación HTML. Puede tardar 1–2
                  minutos.
                </p>
                <div className="flex justify-center gap-1 mt-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-violet-600 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Fragments: editing + TTS + review */}
            {step === "editing" && fragments.length > 0 && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-xl font-bold text-[#2d2b2a] flex items-center gap-3">
                    <span>🎙️</span> Epígrafes
                    <span className="text-sm font-normal text-[#6e6b64]">
                      {doneCount}/{fragments.length} con audio
                    </span>
                  </h2>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handlePreviewPresentation}
                      className="px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/10"
                    >
                      👁️ Vista previa presentación
                    </button>
                    <button
                      onClick={handleGenerateBatch}
                      disabled={batchRunning || pendingCount === 0}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
                        batchRunning || pendingCount === 0
                          ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                          : "bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/10"
                      }`}
                    >
                      {batchRunning
                        ? "⏳ Generando (1 a 1)..."
                        : `🎙️ Generar audio (${pendingCount} pendientes)`}
                    </button>
                    <button
                      onClick={handleSaveToFolder}
                      disabled={saving}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 text-sm cursor-pointer ${
                        saving
                          ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                          : directoryHandle
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/10 animate-pulse-subtle"
                          : allHaveAudio
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/10"
                          : "bg-neutral-200 hover:bg-neutral-300 text-neutral-700 border border-[#d5d3c9]"
                      }`}
                    >
                      {saving
                        ? "💾 Guardando..."
                        : directoryHandle
                        ? "💾 Sincronizar carpeta"
                        : "📁 Guardar en carpeta (manual)"}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {fragments.length > 0 && (
                  <div className="bg-[#e8e7e0] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(doneCount / fragments.length) * 100}%` }}
                    />
                  </div>
                )}

                {/* Directory linking banner */}
                {!directoryHandle ? (
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm transition-all duration-300 animate-fadeIn">
                    <div className="space-y-1">
                      <p className="text-amber-800 font-bold flex items-center gap-2 text-sm">
                        <span>⚠️</span> Guardado automático no configurado
                      </p>
                      <p className="text-[#6e6b64] text-xs leading-relaxed">
                        Vincula una carpeta local para guardar el archivo <code className="font-mono bg-black/5 px-1 rounded font-semibold text-neutral-800 text-[11px]">index.html</code> y cada audio MP3 de forma automática a medida que se completen. ¡Evita perder tu progreso!
                      </p>
                    </div>
                    <button
                      onClick={handleChooseDirectory}
                      disabled={saving}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all duration-300 flex items-center gap-2 shadow-md shadow-amber-600/10 hover:shadow-amber-600/20 active:scale-95 self-start md:self-auto shrink-0 cursor-pointer"
                    >
                      <span>📁</span> Vincular Carpeta de Destino
                    </button>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm transition-all duration-300 animate-fadeIn">
                    <div className="space-y-1">
                      <p className="text-emerald-800 font-bold flex items-center gap-2 text-sm">
                        <span>✅</span> Guardado automático activado
                      </p>
                      <p className="text-[#6e6b64] text-xs">
                        Carpeta vinculada: <span className="font-bold text-[#2d2b2a] bg-black/5 px-1.5 py-0.5 rounded font-mono text-[11px]">{directoryHandle.name}</span>. Todos los archivos se guardan allí en tiempo real.
                      </p>
                    </div>
                    <button
                      onClick={handleChooseDirectory}
                      disabled={saving}
                      className="px-3.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-lg transition-colors border border-emerald-200 shrink-0 self-start md:self-auto cursor-pointer"
                    >
                      Cambiar carpeta
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  {fragments.map((fragment, index) => (
                    <div
                      key={fragment.id}
                      className={`bg-[#f9f8f5] border rounded-xl overflow-hidden transition-all shadow-sm ${
                        fragment.resultBlob
                          ? "border-emerald-600/30 bg-emerald-50/10"
                          : fragment.error
                          ? "border-red-600/30 bg-red-50/10"
                          : "border-[#e8e7e0] hover:border-neutral-300"
                      }`}
                    >
                      {/* Fragment header */}
                      <div className="bg-white px-4 py-3 border-b border-[#e8e7e0] flex items-center gap-3">
                        <span className="text-[#6e6b64] font-mono text-sm font-semibold flex-shrink-0">
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          value={fragment.name}
                          onChange={(e) => {
                            const u = [...fragments];
                            u[index] = { ...u[index], name: e.target.value };
                            setFragments(u);
                          }}
                          className="bg-transparent border-none focus:ring-0 text-[#2d2b2a] font-bold p-0 flex-1 min-w-0 hover:bg-black/5 rounded px-2 transition-colors text-sm"
                          placeholder="Nombre del epígrafe"
                        />
                        <span className="text-xs flex-shrink-0">
                          {fragment.resultBlob ? (
                            <span className="text-emerald-700 font-semibold">✅ listo</span>
                          ) : fragment.loading ? (
                            <span className="text-amber-700 animate-pulse font-semibold">⏳ generando…</span>
                          ) : fragment.error ? (
                            <span className="text-red-700 font-semibold">⚠️ error</span>
                          ) : (
                            <span className="text-[#a8a59a]">— pendiente</span>
                          )}
                        </span>
                      </div>

                      {/* Fragment body */}
                      <div className="p-4 space-y-3">
                        <textarea
                          value={fragment.text}
                          onChange={(e) => {
                            const u = [...fragments];
                            u[index] = { ...u[index], text: e.target.value };
                            setFragments(u);
                          }}
                          className="w-full bg-white border border-[#d5d3c9] text-[#2d2b2a] rounded-lg px-4 py-3 focus:outline-none focus:border-violet-600 transition-colors h-28 resize-y text-sm shadow-inner"
                        />

                        <div className="flex items-center gap-4 flex-wrap">
                          <button
                            onClick={() => handleGenerate(index)}
                            disabled={fragment.loading || !fragment.text.trim()}
                            className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm whitespace-nowrap flex-shrink-0 ${
                              fragment.loading
                                ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                                : "bg-neutral-200 hover:bg-neutral-300 text-neutral-700 border border-[#d5d3c9]"
                            }`}
                          >
                            {fragment.loading
                              ? "⏳ Generando..."
                              : fragment.resultUrl
                              ? "🔄 Regenerar"
                              : "▶️ Generar audio"}
                          </button>

                          {fragment.error && (
                            <span
                              className="text-red-700 font-medium text-sm truncate flex-1"
                              title={fragment.error}
                            >
                              ⚠️ {fragment.error}
                            </span>
                          )}

                          {fragment.resultUrl && (
                            <audio
                              controls
                              src={fragment.resultUrl}
                              className="h-9 flex-1 min-w-[180px]"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save success banner */}
                {savedOk && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center shadow-sm">
                    <p className="text-emerald-700 font-bold text-lg">
                      ✅ Archivos guardados correctamente
                    </p>
                    <p className="text-[#6e6b64] text-sm mt-1">
                      index.html + {fragments.length} MP3 guardados en la carpeta seleccionada.
                      Abre index.html en el navegador para ver la presentación.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
