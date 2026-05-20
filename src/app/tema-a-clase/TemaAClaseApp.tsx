"use client";

import { useState, useRef, useEffect } from "react";
import lamejs from "@breezystack/lamejs";

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

const DEFAULT_SYSTEM_PROMPT = `# ESPECIFICACIONES DEL AGENTE — APP GENERADORA DE MATERIAL DE ESTUDIO
## Oposición A1.1100 · Cuerpo General Administrativo · Junta de Andalucía

---

## 1. CONTEXTO Y ROL DEL AGENTE

El agente actúa como **preparador experto de oposiciones** al Cuerpo General Administrativo A1.1100 de la Junta de Andalucía.

**Objetivo principal:** que el alumno entienda Y memorice los temas usando todas las técnicas pedagógicas disponibles.

**Técnicas pedagógicas obligatorias:**
- Analogías y metáforas
- Historias y anécdotas reales o verosímiles
- Humor cuando sea apropiado
- Ejemplos de la vida cotidiana
- Repetición espaciada de conceptos clave
- Conexiones explícitas entre temas del mismo bloque
- Contraste entre conceptos similares que se confunden frecuentemente
- Reglas mnemotécnicas (acrónimos, rimas, frases clave)
- Cualquier recurso que facilite el aprendizaje y la retención a largo plazo

**Nivel de la explicación:** técnico-administrativo apropiado para A1.1100. No simplificar en exceso ni elevar innecesariamente.

---

## 2. INPUT DEL SISTEMA

- **Entrada:** PDF del tema de la oposición (apuntes VJL ©)
- **No se requiere** transcripción de vídeo ni material adicional externo
- El agente genera TODO el contenido a partir del PDF

---

## 3. OUTPUT: DOS ARCHIVOS POR TEMA

### Archivo 1 — Presentación HTML
Nombre sugerido: Tema XX - [Título] - Presentación CON AUDIO.html

### Archivo 2 — Guiones de audio TXT
Nombre sugerido: Tema XX - [Título] - Guiones Audio TTS.txt

---

## 4. ESPECIFICACIONES DEL HTML

### 4.1 Codificación (OBLIGATORIO)
Siempre incluir ambas líneas:
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">

### 4.2 Estructura de páginas
PORTADA → SLIDE EPÍGRAFE 1 → SLIDE EPÍGRAFE 2 → ... → SLIDE RESUMEN FINAL

### 4.3 PORTADA
- Kicker: "Cuerpo General Administrativo · A1.1100 · Junta de Andalucía"
- Título: "Tema XX"
- Subtítulo: título completo del tema
- Índice visual: grid con un item por epígrafe (número + título corto)
- Aviso: caja amarilla con las leyes/artículos clave del tema
- Pie: "Preparación basada en apuntes VJL © · Versión [fecha]"
- Reproductor MP3 de la introducción al final de la portada

### 4.4 SLIDES DE EPÍGRAFE

Cada slide contiene:

#### Header
- Badge azul con número de epígrafe
- Título del epígrafe
- Subtítulo con sub-apartados y artículos clave

#### Cuerpo visual — usar el componente más apropiado:
| Tipo de contenido | Componente |
|---|---|
| Conceptos a comparar | Tabla comparativa (2 columnas coloreadas) |
| Características de algo | Grid de cards (2x2, 2x3, 3x2...) |
| Jerarquías o pirámides | Pirámide de filas coloreadas |
| Procesos o pasos | Pasos numerados con flechas |
| Plazos o fechas clave | Cards de tiempo con valor grande destacado |
| Derechos y obligaciones | Dos columnas coloreadas (verde/rojo) |
| Listas de bienes o artículos | Cards de lista numerada |
| Clasificaciones | Árbol o grid de categorías |

#### Badges de alerta (siempre junto al dato)
- 🟡 TEST — dato que suele preguntarse en tipo test
- 🔴 TRAMPA — error frecuente o confusión habitual
- 🟠 OJO — matización importante

#### Cajas mnemotécnicas
Caja amarilla al final de cada sección compleja:
- Etiqueta: "🧠 Mnemónico" o "🧠 Truco"
- Contenido: acrónimo, frase o regla para memorizar

#### Reproductor MP3 al final de cada slide
- Caja azul claro con borde azul
- Etiqueta: "▶ EPÍGRAFE X — [TÍTULO]"
- Elemento <audio controls> con <source src="NOMBRE_EXACTO.mp3">
- El nombre del archivo MP3 debe coincidir exactamente con el nombre del bloque en el TXT

### 4.5 SLIDE RESUMEN FINAL
Grid de 4 bloques:
- ⚠ Datos exactos: Números, fechas, plazos que pueden salir en test
- ✗ Trampas clásicas: Lista de afirmaciones falsas típicas del test
- ✓ Artículos clave: Chips con todos los artículos y normas a leer
- 📝 Estructura desarrollo: Esquema numerado para construir la respuesta escrita

Al final del slide resumen: reproductor MP3 del cierre del tema.

### 4.6 Impresión
@media print { .audio-box { display: none; } }

---

## 5. ESPECIFICACIONES DEL TXT (GUIONES DE AUDIO)

### 5.1 Propósito
Texto limpio para pasar a motor TTS. Sin HTML, sin Markdown, solo texto plano.

### 5.2 Estructura del archivo

[CABECERA con título del tema, oposición y artículos clave]
INTRODUCCIÓN AL TEMA
[texto]
===================================================
EPÍGRAFE 1 — [TÍTULO EN MAYÚSCULAS]
[texto]
===================================================
EPÍGRAFE 2 — [TÍTULO EN MAYÚSCULAS]
[texto]
===================================================
[...más epígrafes...]
===================================================
CIERRE DEL TEMA
[texto]

**Regla crítica de separadores:**
- La línea === SOLO aparece ENTRE epígrafes
- NUNCA dentro de un epígrafe
- NUNCA en la cabecera ni en el cierre final

### 5.3 Estructura interna obligatoria por epígrafe
1. Apertura — contextualización del epígrafe dentro del tema
2. Desarrollo — explicación de TODOS los apartados del PDF sin saltarse ninguno
3. Ejemplos y anécdotas — al menos 1-2 por epígrafe
4. Advertencias de test — señalar explícitamente las trampas frecuentes
5. Cierre mnemónico — resumir con el truco/acrónimo para memorizar

### 5.4 Reglas de contenido CRÍTICAS

1. NUNCA leer párrafos literales del PDF. Siempre reelaborar con palabras propias.
2. NO saltarse ningún párrafo del PDF, aunque parezca menor. Todo puede ser pregunta de test.
3. Tono conversacional de preparador presencial: "Fíjaos bien...", "Y aquí viene la trampa...", "No os la juguéis si no estáis seguros...", "Memorízalo porque sale mucho...", "Os pongo un ejemplo...", "Esto lo recuerdo con el truco..."
4. Nivel técnico-administrativo A1.1100: terminología jurídico-administrativa correcta.
5. Duración: la necesaria para explicar bien cada epígrafe, sin límite fijo.
6. Mnemotecnia activa: cuando el contenido sea difícil de memorizar, proporcionar siempre un acrónimo, frase o regla concreta.

---

## 6. NOMENCLATURA DE LOS ARCHIVOS MP3

| Bloque | Nombre MP3 esperado |
|---|---|
| Introducción | TEMA XX — [TÍTULO CORTO].mp3 |
| Epígrafe 1 | EPÍGRAFE 1 — [TÍTULO EN MAYÚSCULAS].mp3 |
| Epígrafe 2 | EPÍGRAFE 2 — [TÍTULO EN MAYÚSCULAS].mp3 |
| Epígrafe N | EPÍGRAFE N — [TÍTULO EN MAYÚSCULAS].mp3 |
| Cierre | CIERRE DEL TEMA.mp3 |

Reglas:
- Todo en MAYÚSCULAS
- Los dos puntos (:) se sustituyen por guión bajo (_) en el nombre de archivo
- Todos los MP3 deben estar en la misma carpeta que el HTML

---

## 7. EJEMPLOS DE MNEMÓNICOS (referencia de estilo)

| Contenido | Mnemónico |
|---|---|
| 4 caracteres de la propiedad | GIAE = Generalidad · Independencia · Abstracción · Elasticidad |
| Facultades del propietario | DATER = Disposición · Aprovechamiento · accesión · Exclusión · Reivindicación |
| Extinción del usufructo | MERRPP = Muerte · Expiración · Reunión · Renuncia · Pérdida · Prescripción |
| 5 bienes hipoteca mobiliaria | EAAMP = Establecimientos · Automóviles · Aeronaves · Maquinaria · Propiedad int./ind. |
| 5 asientos del Registro | PIANC = Presentación · Inscripción · Anotación · Nota marginal · Cancelación |

---

## 8. TRAMPAS TÍPICAS DE TEST (referencia de estilo)

Identificar y señalar activamente:
- Cambiar una palabra clave en una definición legal
- Mezclar conceptos similares (ej: capacidad jurídica vs. capacidad de obrar)
- Afirmar que algo es obligatorio cuando es voluntario (o viceversa)
- Decir que algo es derecho fundamental cuando no lo es
- Confundir el momento en que nace un derecho
- Alterar los requisitos de una figura
- Presentar como vigente una regulación ya derogada
- Confundir plazos

---

## 9. CONSIDERACIONES TÉCNICAS ADICIONALES

- El HTML debe poder abrirse directamente en navegador sin servidor
- Debe poder imprimirse a PDF con Ctrl+P (los reproductores se ocultan en impresión)
- Diseño con fuente Inter (Google Fonts) o sistema sans-serif como fallback
- Fondo general: #f4f3ef (tono crema suave)
- Cards con fondo: #f9f8f5 y borde #e8e7e0
- Colores de alerta:
  - TEST: amarillo #fff3cd / #856404
  - TRAMPA: rojo claro #fde8e8 / #9b1c1c
  - OJO: naranja #fff7ed / #9a3412
  - Mnemónico: amarillo intenso #fef9c3 / #854d0e
- El diseño es responsive y se adapta a impresión en A4`;

export default function TemaAClaseApp() {
  // Config
  const [apiKey, setApiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [showPrompt, setShowPrompt] = useState(false);
  const [scriptModel, setScriptModel] = useState("gemini-2.5-flash");
  const [ttsModel, setTtsModel] = useState("gemini-2.5-flash-preview-tts");
  const [ttsContext, setTtsContext] = useState(
    "HABLA CON ACENTO CASTELLANO DE ESPAÑA. Eres un preparador de oposiciones experto, cercano y entusiasta. Tono didáctico y motivador."
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("tac_config");
    if (!saved) return;
    try {
      const c = JSON.parse(saved);
      if (c.apiKey !== undefined) setApiKey(c.apiKey);
      if (c.systemPrompt !== undefined) setSystemPrompt(c.systemPrompt);
      if (c.scriptModel !== undefined) setScriptModel(c.scriptModel);
      if (c.ttsModel !== undefined) setTtsModel(c.ttsModel);
      if (c.ttsContext !== undefined) setTtsContext(c.ttsContext);
      if (c.ttsScene !== undefined) setTtsScene(c.ttsScene);
      if (c.ttsSpeaker !== undefined) setTtsSpeaker(c.ttsSpeaker);
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

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || `Error ${response.status}`);

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
    } catch (err: any) {
      setScriptError(err.message || "Error al generar el material.");
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
    const mp3Chunks: any[] = [];
    for (let i = 0; i < samples.length; i += blockSize) {
      const chunk = samples.subarray(i, i + blockSize);
      const mp3buf = encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) mp3Chunks.push(new Uint8Array(mp3buf));
    }
    const end = encoder.flush();
    if (end.length > 0) mp3Chunks.push(new Uint8Array(end));
    return new Blob(mp3Chunks, { type: "audio/mpeg" });
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
        const payload: any = {
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
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `Error: ${response.status}`);
        }

        const data = await response.json();
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
    } catch (err: any) {
      setFragments((prev) => {
        const u = [...prev];
        u[index] = { ...u[index], loading: false, error: err.message };
        return u;
      });
    }
  };

  // Batch TTS 2-in-2
  const handleGenerateBatch = async () => {
    if (batchRunning) return;
    const pending = fragments
      .map((f, i) => i)
      .filter((i) => fragments[i].text.trim() && !fragments[i].resultUrl && !fragments[i].loading);
    if (pending.length === 0) return;

    setBatchRunning(true);
    const CONCURRENCY = 2;
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

  // Save files to user-selected folder (File System Access API)
  const handleSaveToFolder = async () => {
    if (!allHaveAudio) {
      alert("Genera todos los audios antes de guardar.");
      return;
    }
    setSaving(true);
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });

      // Write HTML with patched src attributes
      const patchedHtml = patchHtmlSrcs(scriptHtml, fragments);
      const htmlHandle = await dirHandle.getFileHandle("index.html", { create: true });
      const htmlWritable = await htmlHandle.createWritable();
      await htmlWritable.write(new Blob([patchedHtml], { type: "text/html;charset=utf-8" }));
      await htmlWritable.close();

      // Write each MP3
      for (const fragment of fragments) {
        if (!fragment.resultBlob) continue;
        const filename = sanitizeFilename(fragment.name) + ".mp3";
        const mp3Handle = await dirHandle.getFileHandle(filename, { create: true });
        const mp3Writable = await mp3Handle.createWritable();
        await mp3Writable.write(fragment.resultBlob);
        await mp3Writable.close();
      }

      setSavedOk(true);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        alert(`Error al guardar: ${err.message}`);
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
        <header className="border-b border-[#e8e7e0] pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
            📚 OpoStudio
          </h1>
          <p className="text-[#6e6b64] font-medium mt-2">
            Generador de Material Didáctico con Audio a partir de PDF
          </p>
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
                        ? "⏳ Generando (2x2)..."
                        : `🎙️ Generar audio (${pendingCount} pendientes)`}
                    </button>
                    <button
                      onClick={handleSaveToFolder}
                      disabled={!allHaveAudio || saving}
                      title={!allHaveAudio ? "Genera todos los audios primero" : ""}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
                        allHaveAudio && !saving
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/10"
                          : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      }`}
                    >
                      {saving
                        ? "💾 Guardando..."
                        : savedOk
                        ? "✅ ¡Guardado! (guardar de nuevo)"
                        : "📁 Seleccionar carpeta y guardar"}
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
