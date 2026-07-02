import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Terminal, 
  Copy, 
  Save, 
  Wand2, 
  Settings2,
  RefreshCcw,
  Check,
  BookOpen,
  ChevronDown,
  Lightbulb,
  Target,
  Clock,
  ThumbsUp,
  AlertTriangle,
  Sparkles,
  Gauge,
  Wrench,
  Play,
  GraduationCap,
  TrendingUp,
  X,
  Layers,
  Coins,
  History,
  Columns2,
  FileStack,
  FileDown,
  Boxes,
  Printer
} from "lucide-react";
import { DB, SavedPrompt } from "../types";
import { getAIConfig } from "../aiConfig";
import { PROMPT_TECHNIQUES, PROMPT_FAMILIES, PromptTechnique } from "../data/promptTechniques";
import { toast } from "sonner";
import axios from "axios";
import { cn } from "@/lib/utils";

interface PromptGeneratorProps {
  db: DB;
  updateDb: (db: DB) => void;
}

export function PromptGenerator({ db, updateDb }: PromptGeneratorProps) {
  const [audience, setAudience] = useState("");
  const [format, setFormat] = useState("text");
  const [style, setStyle] = useState("professional");
  const [detail, setDetail] = useState("medium");
  const [topic, setTopic] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTechnique, setSelectedTechnique] = useState<string>("");
  const [expandedTechnique, setExpandedTechnique] = useState<string | null>(null);

  // ── Constructor C.R.E.F.O. ──
  const [crefoMode, setCrefoMode] = useState(false);
  const [crefoContexto, setCrefoContexto] = useState("");
  const [crefoRol, setCrefoRol] = useState("");
  const [crefoEspecificos, setCrefoEspecificos] = useState("");
  const [crefoFormato, setCrefoFormato] = useState("");
  const [crefoObjetivo, setCrefoObjetivo] = useState("");

  // Ensambla los 5 bloques C.R.E.F.O. en un prompt estructurado con las etiquetas del método
  const buildCrefoText = () => {
    const parts: string[] = [];
    if (crefoContexto.trim()) parts.push(`[CONTEXTO] ${crefoContexto.trim()}`);
    if (crefoRol.trim()) parts.push(`[ROL] ${crefoRol.trim()}`);
    if (crefoEspecificos.trim()) parts.push(`[ESPECÍFICOS] ${crefoEspecificos.trim()}`);
    if (crefoFormato.trim()) parts.push(`[FORMATO] ${crefoFormato.trim()}`);
    if (crefoObjetivo.trim()) parts.push(`[OBJETIVO] ${crefoObjetivo.trim()}`);
    return parts.join("\n");
  };

  const crefoFilled = [crefoContexto, crefoRol, crefoEspecificos, crefoFormato, crefoObjetivo].filter((v) => v.trim()).length;

  // ── Herramientas sobre el prompt generado: evaluar / mejorar / ejecutar / explicar ──
  const [toolAction, setToolAction] = useState<string>("");
  const [toolLoading, setToolLoading] = useState<string>("");
  const [evalResult, setEvalResult] = useState<any>(null);
  const [refineResult, setRefineResult] = useState<string>("");
  const [runResult, setRunResult] = useState<string>("");
  const [explainResult, setExplainResult] = useState<any>(null);

  const parseJsonSafe = (text: string) => {
    try {
      const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  };

  const runTool = async (action: "evaluate" | "refine" | "run" | "explain") => {
    if (!generatedPrompt) return;
    setToolLoading(action);
    setToolAction(action);
    // Limpiar resultados previos del resto de herramientas para no confundir
    if (action === "evaluate") { setRefineResult(""); setRunResult(""); setExplainResult(null); }
    if (action === "refine") { setEvalResult(null); setRunResult(""); setExplainResult(null); }
    if (action === "run") { setEvalResult(null); setRefineResult(""); setExplainResult(null); }
    if (action === "explain") { setEvalResult(null); setRefineResult(""); setRunResult(""); }
    try {
      const { provider, model } = getAIConfig();
      const res = await axios.post("/api/prompt-tools", { action, prompt: generatedPrompt, provider, model });
      const result = res.data.result || "";
      if (action === "evaluate") {
        const parsed = parseJsonSafe(result);
        if (parsed) setEvalResult(parsed); else toast.error("No se pudo interpretar la evaluación");
      } else if (action === "refine") {
        setRefineResult(result);
      } else if (action === "run") {
        setRunResult(result);
      } else if (action === "explain") {
        const parsed = parseJsonSafe(result);
        if (parsed) setExplainResult(parsed); else toast.error("No se pudo interpretar la explicación");
      }
      toast.success("Análisis completado");
    } catch (error: any) {
      toast.error("Error en la herramienta", { description: error.response?.data?.details || error.message });
    } finally {
      setToolLoading("");
    }
  };

  const clearTools = () => {
    setToolAction(""); setEvalResult(null); setRefineResult(""); setRunResult(""); setExplainResult(null);
  };

  // ── Plantillas C.R.E.F.O. por sector (cargables) ──
  const CREFO_TEMPLATES = [
    {
      id: "calzado",
      name: "PYME de calzado",
      sector: "Comercio / Retail",
      contexto: "Somos una PYME española de calzado artesanal con 8 años de historia, ventas principalmente en tienda física, intentando expandirnos al canal online.",
      rol: "Actúa como consultor experto en transformación digital para pequeñas empresas.",
      especificos: "Usa tono profesional, sin emojis. Evita herramientas con coste mensual superior a 50€. Incluye al menos una acción ejecutable esta semana.",
      formato: "Devuelve una tabla con 5 estrategias que incluya: Estrategia | Canal | Acción concreta | Plazo | KPI de éxito.",
      objetivo: "Aumentar las ventas online un 20% en los próximos 6 meses.",
    },
    {
      id: "academia",
      name: "Academia de formación",
      sector: "Educación",
      contexto: "Somos un centro de formación profesional para personas adultas, con cursos presenciales y necesidad de captar más alumnado para la próxima convocatoria.",
      rol: "Actúa como experto en marketing educativo y captación de estudiantes.",
      especificos: "Tono cercano pero profesional. Presupuesto de marketing limitado. Prioriza canales gratuitos o de bajo coste.",
      formato: "Devuelve una lista priorizada de 6 acciones, cada una con: Acción | Canal | Coste estimado | Esfuerzo (alto/medio/bajo).",
      objetivo: "Llenar dos grupos de 15 alumnos para el próximo trimestre.",
    },
    {
      id: "despacho",
      name: "Despacho profesional",
      sector: "Servicios / Legal",
      contexto: "Somos un despacho que presta servicios profesionales a pymes y queremos automatizar tareas repetitivas de gestión documental y atención a clientes.",
      rol: "Actúa como consultor en automatización de procesos para despachos.",
      especificos: "Cumple con la protección de datos (RGPD). Prioriza soluciones que no requieran programación. Señala riesgos de cada propuesta.",
      formato: "Devuelve una tabla: Proceso | Herramienta propuesta | Ahorro estimado de tiempo | Riesgo a vigilar.",
      objetivo: "Reducir en un 30% el tiempo dedicado a tareas administrativas repetitivas.",
    },
    {
      id: "restaurante",
      name: "Restaurante local",
      sector: "Hostelería",
      contexto: "Somos un restaurante de cocina tradicional en una ciudad media, con buena clientela local pero poca presencia digital.",
      rol: "Actúa como especialista en marketing gastronómico y redes sociales.",
      especificos: "Tono apetitoso y cercano. Sin grandes inversiones. Aprovecha el contenido visual del propio restaurante.",
      formato: "Devuelve un plan semanal en tabla: Día | Plataforma | Tipo de contenido | Objetivo.",
      objetivo: "Aumentar las reservas de fin de semana un 25% en 3 meses.",
    },
  ];

  const loadTemplate = (t: typeof CREFO_TEMPLATES[number]) => {
    setCrefoMode(true);
    setCrefoContexto(t.contexto);
    setCrefoRol(t.rol);
    setCrefoEspecificos(t.especificos);
    setCrefoFormato(t.formato);
    setCrefoObjetivo(t.objetivo);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success(`Plantilla "${t.name}" cargada en C.R.E.F.O.`);
  };

  // ── Estimación de tokens y coste aproximado ──
  // Aproximación: ~4 caracteres por token. Precios orientativos por 1K tokens de salida.
  const estimateTokens = (text: string) => Math.max(1, Math.round(text.length / 4));
  const COST_PER_1K: Record<string, number> = { openai: 0.01, gemini: 0.0, claude: 0.015 };
  const promptTokens = generatedPrompt ? estimateTokens(generatedPrompt) : 0;

  // ── Historial de prompts COMPARTIDO (servidor, visible desde cualquier navegador) ──
  interface PromptVersion { id: string; content: string; label: string; at: number; }
  const [history, setHistory] = useState<PromptVersion[]>([]);

  const loadHistory = async () => {
    try {
      const res = await axios.get("/api/prompt-history");
      setHistory(Array.isArray(res.data.history) ? res.data.history : []);
    } catch { /* si el endpoint aún no existe en el servidor, el historial queda vacío sin error */ }
  };

  useEffect(() => { loadHistory(); }, []);

  // Agrupa el historial por día (Hoy / Ayer / fecha larga), conservando el orden reciente→antiguo
  const groupHistoryByDay = (items: PromptVersion[]) => {
    const startOfDay = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const today = startOfDay(Date.now());
    const oneDay = 86400000;
    const labelFor = (ts: number) => {
      const day = startOfDay(ts);
      if (day === today) return "Hoy";
      if (day === today - oneDay) return "Ayer";
      return new Date(ts).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    };
    const groups: { key: number; label: string; items: PromptVersion[] }[] = [];
    for (const item of items) {
      const key = startOfDay(item.at);
      let g = groups.find((x) => x.key === key);
      if (!g) { g = { key, label: labelFor(item.at), items: [] }; groups.push(g); }
      g.items.push(item);
    }
    // Orden de los grupos: día más reciente primero
    groups.sort((a, b) => b.key - a.key);
    return groups;
  };

  const pushHistory = async (content: string, label: string) => {
    if (!content.trim()) return;
    // Optimista: lo mostramos ya, y lo confirmamos con el servidor
    const optimistic = { id: "tmp-" + Math.random().toString(36).slice(2, 9), content, label, at: Date.now() };
    setHistory((prev) => [optimistic, ...prev].slice(0, 500));
    try {
      await axios.post("/api/prompt-history", { content, label });
      loadHistory(); // recargar para tener el id real del servidor
    } catch { /* si falla el guardado en servidor, al menos queda en pantalla esta sesión */ }
  };

  const clearHistory = async () => {
    if (!window.confirm("¿Vaciar todo el historial de prompts? Esto afecta a todos los usuarios.")) return;
    try {
      await axios.delete("/api/prompt-history");
      setHistory([]);
      toast.success("Historial vaciado");
    } catch (e: any) {
      toast.error("No se pudo vaciar", { description: "Puede requerir desbloquear la consola en Configuración." });
    }
  };

  // ── Comparador de prompts (variante A/B) ──
  const [compareMode, setCompareMode] = useState(false);
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  const [comparing, setComparing] = useState(false);

  const generateComparison = async () => {
    const effectiveTopic = crefoMode ? buildCrefoText() : topic;
    if (!effectiveTopic.trim()) { toast.error("Introduce un objetivo o rellena C.R.E.F.O. primero"); return; }
    setComparing(true);
    setVariantA(""); setVariantB("");
    try {
      const { provider, model, apiKey } = getAIConfig();
      const base = { audience, format, style, detail, apiKey, provider, model };
      // Variante A: sin técnica específica (auto). Variante B: con la técnica seleccionada (o few-shot por defecto).
      const techB = selectedTechnique || "few-shot";
      const [resA, resB] = await Promise.all([
        axios.post("/api/generate-prompt", { ...base, topic: effectiveTopic, promptType: "auto" }),
        axios.post("/api/generate-prompt", { ...base, topic: effectiveTopic, promptType: techB }),
      ]);
      setVariantA(resA.data.prompt || "");
      setVariantB(resB.data.prompt || "");
      toast.success("Dos variantes generadas para comparar");
    } catch (error: any) {
      toast.error("Error al comparar", { description: error.response?.data?.details || error.message });
    } finally {
      setComparing(false);
    }
  };

  // ── Exportar prompt + evaluación a Word (.doc) y PDF ──
  const buildExportHTML = () => {
    const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleString("es-ES");
    let evalHTML = "";
    if (evalResult) {
      const rows = [
        ["Claridad", evalResult.claridad],
        ["Especificidad", evalResult.especificidad],
        ["Contexto", evalResult.contexto],
        ["Global", evalResult.global],
      ].map(([k, v]) => `<tr><td style="padding:4px 10px;border:1px solid #ccc;">${k}</td><td style="padding:4px 10px;border:1px solid #ccc;text-align:center;font-weight:bold;">${v ?? "—"}/10</td></tr>`).join("");
      const fort = Array.isArray(evalResult.fortalezas) ? evalResult.fortalezas.map((f: string) => `<li>${esc(f)}</li>`).join("") : "";
      const mej = Array.isArray(evalResult.mejoras) ? evalResult.mejoras.map((m: string) => `<li>${esc(m)}</li>`).join("") : "";
      evalHTML = `
        <h2 style="color:#1B2A4A;">Evaluación del prompt</h2>
        <table style="border-collapse:collapse;margin-bottom:12px;">${rows}</table>
        ${fort ? `<h3 style="color:#0EA5A8;">Lo que está bien</h3><ul>${fort}</ul>` : ""}
        ${mej ? `<h3 style="color:#b45309;">Qué se puede mejorar</h3><ul>${mej}</ul>` : ""}`;
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Prompt — MarkItPlace</title></head>
      <body style="font-family:Arial,sans-serif;color:#44505E;line-height:1.5;padding:24px;">
        <div style="border-bottom:3px solid #0EA5A8;padding-bottom:8px;margin-bottom:16px;">
          <div style="font-size:11px;color:#6D5BD0;font-weight:bold;text-transform:uppercase;">Cibermedida · MarkItPlace</div>
          <h1 style="color:#1B2A4A;margin:4px 0;">Prompt generado</h1>
          <div style="font-size:11px;color:#888;">${fecha}${selectedTechnique ? " · Técnica: " + esc(selectedTechnique) : ""}${crefoMode ? " · Framework C.R.E.F.O." : ""}</div>
        </div>
        <h2 style="color:#1B2A4A;">Prompt</h2>
        <pre style="white-space:pre-wrap;font-family:Consolas,monospace;font-size:13px;background:#f4f7f9;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">${esc(generatedPrompt)}</pre>
        ${evalHTML}
        <p style="font-size:10px;color:#aaa;margin-top:24px;border-top:1px solid #eee;padding-top:8px;">Generado con MarkItPlace · markitplace.cibermedida.es</p>
      </body></html>`;
  };

  const exportWord = () => {
    if (!generatedPrompt) return;
    const blob = new Blob(["\uFEFF" + buildExportHTML()], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prompt-cibermedida-${Date.now()}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Documento Word descargado");
  };

  const exportPDF = () => {
    if (!generatedPrompt) return;
    const win = window.open("", "_blank");
    if (!win) { toast.error("Permite las ventanas emergentes para exportar a PDF"); return; }
    win.document.write(buildExportHTML() + '<' + 'script>window.onload=function(){window.print();}<' + '/script>');
    win.document.close();
    toast.success('Abriendo impresión: elige "Guardar como PDF"');
  };

  // ── Modo multimodelo: lanzar el mismo prompt a OpenAI, Gemini y Claude ──
  const [multiResults, setMultiResults] = useState<Record<string, string>>({});
  const [multiLoading, setMultiLoading] = useState(false);

  const runMultiModel = async () => {
    if (!generatedPrompt) return;
    setMultiLoading(true);
    setMultiResults({});
    const providers = ["openai", "gemini", "claude"];
    try {
      const settled = await Promise.allSettled(
        providers.map((p) => axios.post("/api/prompt-tools", { action: "run", prompt: generatedPrompt, provider: p }))
      );
      const out: Record<string, string> = {};
      settled.forEach((r, i) => {
        out[providers[i]] = r.status === "fulfilled"
          ? (r.value.data.result || "(sin respuesta)")
          : "Este proveedor no respondió (¿falta su API key en el servidor?)";
      });
      setMultiResults(out);
      toast.success("Respuestas de los 3 modelos");
    } catch {
      toast.error("Error al consultar los modelos");
    } finally {
      setMultiLoading(false);
    }
  };

  const generatePrompt = async () => {
    const effectiveTopic = crefoMode ? buildCrefoText() : topic;
    if (!effectiveTopic.trim()) {
      toast.error(crefoMode ? "Rellena al menos un bloque C.R.E.F.O." : "Por favor, introduce un tema o tarea para el prompt");
      return;
    }

    setLoading(true);
    try {
      const { provider, model, apiKey } = getAIConfig();
      const payload = {
        topic: effectiveTopic,
        audience,
        format,
        style,
        detail,
        apiKey,
        provider,
        model,
        promptType: selectedTechnique || "auto",
        framework: crefoMode ? "crefo" : undefined,
      };

      const response = await axios.post("/api/generate-prompt", payload);
      const result = response.data.prompt || "Generation failure";
      setGeneratedPrompt(result);
      clearTools();
      pushHistory(result, crefoMode ? "C.R.E.F.O." + (selectedTechnique ? ` + ${selectedTechnique}` : "") : (selectedTechnique || "simple"));
      
      const newDb = { ...db };
      newDb.stats.totalTokens += result.length / 4;
      updateDb(newDb);
      
      toast.success("Prompt generado con éxito");
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.details || error.message;
      toast.error("Error de conexión con el Nodo IA", { description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado a la clipboard");
  };

  const savePrompt = () => {
    if (!generatedPrompt) return;

    const newPrompt: SavedPrompt = {
      id: Math.random().toString(36).substr(2, 9),
      title: topic.slice(0, 30) + (topic.length > 30 ? "..." : ""),
      content: generatedPrompt,
      type: 'advanced',
      tags: [format, style],
      category: "Engineering",
      isFavorite: false,
      createdAt: Date.now(),
    };

    const newDb = { ...db, prompts: [newPrompt, ...db.prompts] };
    updateDb(newDb);
    toast.success("Artefacto guardado en el Lab");
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between lg:gap-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            Laboratorio / <span className="text-indigo-600">Nodo de Ingeniería de Prompts</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Lab de Prompts Avanzado</h2>
          <p className="text-sm text-slate-500">Configura parámetros para generar directivas de IA de alta precisión.</p>
        </div>
        {selectedTechnique && (
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-700">
              Técnica activa: {PROMPT_TECHNIQUES.find((t) => t.id === selectedTechnique)?.name}
            </span>
            <button onClick={() => setSelectedTechnique("")} className="text-indigo-400 hover:text-indigo-700 ml-1" title="Quitar técnica">
              <RefreshCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration */}
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-indigo-500" /> Matriz de Parámetros
            </CardTitle>
            <Button 
                variant="ghost" 
                size="sm"
                className="h-7 text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase"
                onClick={() => { setTopic(""); setAudience(""); setGeneratedPrompt(""); setCrefoContexto(""); setCrefoRol(""); setCrefoEspecificos(""); setCrefoFormato(""); setCrefoObjetivo(""); }}
              >
                <RefreshCcw className="w-3 h-3 mr-2" /> Reiniciar
            </Button>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 flex-1">
            {/* Conmutador de modo: Simple vs C.R.E.F.O. */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setCrefoMode(false)}
                className={cn("flex-1 text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg transition-all",
                  !crefoMode ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                Modo simple
              </button>
              <button
                onClick={() => setCrefoMode(true)}
                className={cn("flex-1 text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
                  crefoMode ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                <Sparkles className="w-3.5 h-3.5" /> Constructor C.R.E.F.O.
              </button>
            </div>

            {!crefoMode ? (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Objetivo de la Misión</Label>
                <Textarea 
                  placeholder="Describe el comportamiento o tarea deseada de la IA..." 
                  className="rounded-lg border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-24 text-sm"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <FileStack className="w-3.5 h-3.5" /> Plantillas por sector
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CREFO_TEMPLATES.map((t) => (
                      <button key={t.id} onClick={() => loadTemplate(t)}
                        className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 px-3 py-1.5 rounded-full transition-colors"
                        title={t.sector}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Construye tu prompt por bloques</Label>
                  <span className="text-[10px] font-bold text-indigo-600">{crefoFilled}/5</span>
                </div>
                {[
                  { key: "C", label: "Contexto", help: "La situación de partida: quién eres, tu sector, tu punto actual.", value: crefoContexto, set: setCrefoContexto, ph: "Somos una PYME española de calzado artesanal con 8 años de historia..." },
                  { key: "R", label: "Rol", help: "El papel que asignas a la IA.", value: crefoRol, set: setCrefoRol, ph: "Actúa como consultor experto en transformación digital..." },
                  { key: "E", label: "Específicos", help: "Restricciones y condiciones concretas que debe cumplir.", value: crefoEspecificos, set: setCrefoEspecificos, ph: "Tono profesional, sin emojis. Evita herramientas de más de 50€/mes..." },
                  { key: "F", label: "Formato", help: "Cómo quieres exactamente la salida.", value: crefoFormato, set: setCrefoFormato, ph: "Una tabla con: Estrategia | Canal | Acción | Plazo | KPI..." },
                  { key: "O", label: "Objetivo", help: "La meta final, medible si es posible.", value: crefoObjetivo, set: setCrefoObjetivo, ph: "Aumentar las ventas online un 20% en 6 meses..." },
                ].map((b) => (
                  <div key={b.key} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-extrabold flex-shrink-0">{b.key}</span>
                      <Label className="text-xs font-bold text-slate-700">{b.label}</Label>
                    </div>
                    <p className="text-[10px] text-slate-400 ml-8 -mt-1">{b.help}</p>
                    <Textarea
                      placeholder={b.ph}
                      className="rounded-lg border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-16 text-sm ml-0"
                      value={b.value}
                      onChange={(e) => b.set(e.target.value)}
                    />
                  </div>
                ))}
                <button
                  onClick={() => { setCrefoContexto(""); setCrefoRol(""); setCrefoEspecificos(""); setCrefoFormato(""); setCrefoObjetivo(""); }}
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-600 uppercase tracking-wider flex items-center gap-1"
                >
                  <RefreshCcw className="w-3 h-3" /> Vaciar bloques
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Público Objetivo</Label>
                <Input 
                  placeholder="ej. Científicos de Datos" 
                  className="rounded-lg border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Firma de Salida</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="rounded-lg border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" sideOffset={4} align="start" alignItemWithTrigger={false} className="rounded-xl border-slate-200 bg-white">
                    <SelectItem value="text">TEXTO PLANO</SelectItem>
                    <SelectItem value="json">ESQUEMA JSON</SelectItem>
                    <SelectItem value="steps">PASOS PRECEDURALES</SelectItem>
                    <SelectItem value="markdown">TABLAS MARKDOWN</SelectItem>
                    <SelectItem value="python">LÓGICA PYTHON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Arquetipo de Escritura</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="rounded-lg border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" sideOffset={4} align="start" alignItemWithTrigger={false} className="rounded-xl border-slate-200 bg-white">
                    <SelectItem value="professional">PROFESIONAL</SelectItem>
                    <SelectItem value="creative">CREATIVO</SelectItem>
                    <SelectItem value="technical">TÉCNICO</SelectItem>
                    <SelectItem value="minimal">MINIMALISTA</SelectItem>
                    <SelectItem value="academic">ACADÉMICO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nivel de Densidad</Label>
                <Select value={detail} onValueChange={setDetail}>
                  <SelectTrigger className="rounded-lg border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" sideOffset={4} align="start" alignItemWithTrigger={false} className="rounded-xl border-slate-200 bg-white">
                    <SelectItem value="brief">CONCISO</SelectItem>
                    <SelectItem value="medium">EQUILIBRADO</SelectItem>
                    <SelectItem value="extensive">EXHAUSTIVO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-widest text-xs h-12 transition-all shadow-lg shadow-indigo-200 group mt-4"
              onClick={generatePrompt}
              disabled={loading}
            >
              {loading ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />}
              {loading ? "Construyendo directiva..." : "Generar Prompt"}
            </Button>

            <Button
              variant="outline"
              className="w-full rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-700 font-bold uppercase tracking-widest text-xs h-11"
              onClick={() => { setCompareMode(true); generateComparison(); }}
              disabled={comparing}
            >
              {comparing ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <Columns2 className="w-4 h-4 mr-2" />}
              {comparing ? "Comparando..." : "Comparar 2 variantes (A/B)"}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col relative">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-500" /> Resultado Compilado
            </CardTitle>
            {generatedPrompt && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase" title="Estimación aproximada (~4 caracteres por token)">
                  <Coins className="w-3 h-3" /> ~{promptTokens} tokens
                  {(() => { const { provider } = getAIConfig(); const cost = (promptTokens / 1000) * (COST_PER_1K[provider] ?? 0); return cost > 0 ? ` · ~$${cost.toFixed(4)}` : ""; })()}
                </span>
                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded uppercase">Lógica Validada</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6 flex-1 flex flex-col min-h-[400px]">
            {generatedPrompt ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 font-mono text-[13px] leading-relaxed relative whitespace-pre-wrap text-slate-100 shadow-inner">
                  {generatedPrompt}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <Button 
                        variant="secondary" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white border border-slate-700 transition-colors" 
                        onClick={copyToClipboard}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <Button 
                    className="flex-1 rounded-xl border-2 border-slate-200 bg-white text-slate-900 hover:bg-slate-50 font-bold uppercase text-xs h-12 transition-colors shadow-sm"
                    onClick={savePrompt}
                  >
                    <Save className="w-4 h-4 mr-2" /> Guardar en Hub
                  </Button>
                  <Button 
                    className="flex-1 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 font-bold uppercase text-xs h-12 transition-colors shadow-lg shadow-slate-200"
                    onClick={generatePrompt}
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" /> Re-construir
                  </Button>
                </div>

                {/* ── Herramientas sobre el prompt ── */}
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Analiza y mejora este prompt</span>
                    {toolAction && (
                      <button onClick={clearTools} className="text-[10px] font-bold text-slate-400 hover:text-rose-600 uppercase flex items-center gap-1">
                        <X className="w-3 h-3" /> Cerrar análisis
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "evaluate", label: "Evaluar", icon: Gauge, color: "hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700" },
                      { id: "refine", label: "Mejorar", icon: Wrench, color: "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700" },
                      { id: "run", label: "Ejecutar", icon: Play, color: "hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700" },
                      { id: "explain", label: "Explicar", icon: GraduationCap, color: "hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700" },
                    ].map((t) => (
                      <button key={t.id} onClick={() => runTool(t.id as any)} disabled={!!toolLoading}
                        className={cn("flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-slate-200 text-slate-500 transition-all text-[10px] font-bold uppercase tracking-wider disabled:opacity-40", t.color,
                          toolAction === t.id && "border-indigo-300 bg-indigo-50 text-indigo-700")}>
                        {toolLoading === t.id ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <t.icon className="w-4 h-4" />}
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Exportar y multimodelo */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={exportWord} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 text-[10px] font-bold uppercase tracking-wider transition-all">
                      <FileDown className="w-3.5 h-3.5" /> Word
                    </button>
                    <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 text-[10px] font-bold uppercase tracking-wider transition-all">
                      <Printer className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button onClick={runMultiModel} disabled={multiLoading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40">
                      {multiLoading ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Boxes className="w-3.5 h-3.5" />} Comparar 3 modelos
                    </button>
                  </div>

                  {/* Resultado: Multimodelo */}
                  {Object.keys(multiResults).length > 0 && (
                    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">El mismo prompt en los 3 modelos</div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {[
                          { key: "openai", label: "OpenAI", color: "bg-emerald-600" },
                          { key: "gemini", label: "Gemini", color: "bg-blue-600" },
                          { key: "claude", label: "Claude", color: "bg-orange-600" },
                        ].map((m) => (
                          <div key={m.key} className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                            <div className={cn("px-3 py-2 text-white text-[10px] font-bold uppercase tracking-wider", m.color)}>{m.label}</div>
                            <div className="p-3 text-[11px] text-slate-600 whitespace-pre-wrap max-h-64 overflow-auto flex-1">
                              {multiResults[m.key] || "(sin respuesta)"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resultado: Evaluar */}
                  {evalResult && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { label: "Claridad", value: evalResult.claridad },
                          { label: "Especificidad", value: evalResult.especificidad },
                          { label: "Contexto", value: evalResult.contexto },
                          { label: "Global", value: evalResult.global },
                        ].map((s) => (
                          <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                            <div className={cn("text-2xl font-extrabold",
                              (s.value || 0) >= 8 ? "text-emerald-600" : (s.value || 0) >= 5 ? "text-amber-600" : "text-rose-600")}>
                              {s.value ?? "—"}<span className="text-xs text-slate-300">/10</span>
                            </div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {Array.isArray(evalResult.fortalezas) && evalResult.fortalezas.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">
                            <ThumbsUp className="w-3.5 h-3.5" /> Lo que está bien
                          </div>
                          <ul className="space-y-1">
                            {evalResult.fortalezas.map((f: string, i: number) => (
                              <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-emerald-500">+</span> {f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(evalResult.mejoras) && evalResult.mejoras.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">
                            <TrendingUp className="w-3.5 h-3.5" /> Qué se puede mejorar
                          </div>
                          <ul className="space-y-1">
                            {evalResult.mejoras.map((m: string, i: number) => (
                              <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-amber-500">→</span> {m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resultado: Mejorar */}
                  {refineResult && (
                    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Versión mejorada</div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-emerald-100 max-h-72 overflow-auto">{refineResult}</div>
                      <Button onClick={() => { setGeneratedPrompt(refineResult); setRefineResult(""); setToolAction(""); toast.success("Prompt sustituido por la versión mejorada"); }}
                        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest text-xs h-11">
                        <Check className="w-4 h-4 mr-2" /> Usar esta versión mejorada
                      </Button>
                    </div>
                  )}

                  {/* Resultado: Ejecutar */}
                  {runResult && (
                    <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider">Respuesta de la IA</div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs leading-relaxed whitespace-pre-wrap text-slate-700 max-h-80 overflow-auto">{runResult}</div>
                    </div>
                  )}

                  {/* Resultado: Explicar */}
                  {explainResult && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      {Array.isArray(explainResult.tecnicas) && explainResult.tecnicas.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-2">Técnicas detectadas</div>
                          <div className="space-y-2">
                            {explainResult.tecnicas.map((t: any, i: number) => (
                              <div key={i} className="bg-purple-50 rounded-lg p-3">
                                <div className="text-xs font-bold text-purple-800">{t.nombre}</div>
                                <p className="text-xs text-slate-600 mt-0.5">{t.descripcion}</p>
                                {t.donde && <p className="text-[11px] text-slate-400 italic mt-1 border-l-2 border-purple-200 pl-2">{t.donde}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {explainResult.porQueFunciona && (
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Por qué funciona</div>
                          <p className="text-xs text-slate-600">{explainResult.porQueFunciona}</p>
                        </div>
                      )}
                      {explainResult.consejoDocente && (
                        <div className="bg-indigo-50 border-l-4 border-indigo-300 rounded-r-lg p-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">
                            <GraduationCap className="w-3.5 h-3.5" /> Consejo docente
                          </div>
                          <p className="text-xs text-slate-700">{explainResult.consejoDocente}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl m-2">
                <div className="p-4 bg-slate-50 rounded-full mb-4">
                  <Terminal className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Esperando Inyección de Parámetros...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════════ COMPARADOR A/B ══════════ */}
      {compareMode && (variantA || variantB || comparing) && (
        <div className="pt-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                <Columns2 className="w-4 h-4 text-indigo-500" /> Comparador
              </div>
              <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Variante A vs Variante B</h3>
              <p className="text-sm text-slate-500">A = enfoque automático · B = con técnica aplicada. Compara y quédate con la mejor.</p>
            </div>
            <button onClick={() => { setCompareMode(false); setVariantA(""); setVariantB(""); }} className="text-[10px] font-bold text-slate-400 hover:text-rose-600 uppercase flex items-center gap-1">
              <X className="w-3 h-3" /> Cerrar
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {[
              { label: "Variante A · Automático", content: variantA, color: "indigo" },
              { label: "Variante B · Con técnica", content: variantB, color: "purple" },
            ].map((v) => (
              <Card key={v.label} className="rounded-xl border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className={cn("px-4 py-2.5 flex items-center justify-between", v.color === "indigo" ? "bg-indigo-600" : "bg-purple-600")}>
                  <span className="text-white font-bold text-xs uppercase tracking-wider">{v.label}</span>
                  {v.content && <span className="text-white/70 text-[10px] font-bold">~{estimateTokens(v.content)} tokens</span>}
                </div>
                <CardContent className="p-0 flex-1">
                  {comparing && !v.content ? (
                    <div className="flex items-center justify-center h-48 text-slate-300"><RefreshCcw className="w-6 h-6 animate-spin" /></div>
                  ) : (
                    <pre className="p-4 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-80 overflow-auto">{v.content}</pre>
                  )}
                </CardContent>
                {v.content && (
                  <div className="p-3 border-t border-slate-100 bg-slate-50">
                    <Button onClick={() => { setGeneratedPrompt(v.content); pushHistory(v.content, v.label); window.scrollTo({ top: 0, behavior: "smooth" }); toast.success("Variante elegida como prompt principal"); }}
                      className="w-full rounded-lg bg-slate-900 hover:bg-indigo-600 text-white font-bold uppercase tracking-widest text-[10px] h-9">
                      <Check className="w-3.5 h-3.5 mr-1.5" /> Quedarme con esta
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ HISTORIAL DE VERSIONES ══════════ */}
      {history.length > 0 && (
        <div className="pt-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            <History className="w-4 h-4 text-indigo-500" /> Historial
          </div>
          <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Historial de prompts</h3>
          <p className="text-sm text-slate-500 mb-4">Todos los prompts construidos en esta zona se guardan en el servidor y se ven desde cualquier navegador o dispositivo. Recupera cualquiera con un clic.</p>
          <div className="space-y-5">
            {groupHistoryByDay(history).map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-slate-700 capitalize">{group.label}</span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{group.items.length}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="space-y-2">
                  {group.items.map((v) => (
                    <Card key={v.id} className="rounded-xl border-slate-200 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Layers className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">{v.label}</span>
                            <span className="text-[10px] text-slate-400">{new Date(v.at).toLocaleTimeString("es-ES")}</span>
                            <span className="text-[10px] text-slate-300">~{estimateTokens(v.content)} tokens</span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-1">{v.content.slice(0, 120)}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setGeneratedPrompt(v.content); window.scrollTo({ top: 0, behavior: "smooth" }); toast.success("Versión recuperada"); }}
                          className="rounded-lg text-[10px] font-bold uppercase text-slate-500 hover:text-indigo-600 flex-shrink-0">
                          <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Recuperar
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button onClick={() => {
                  const txt = history.map((v, i) => `### Prompt ${history.length - i} · ${v.label} · ${new Date(v.at).toLocaleString("es-ES")}\n\n${v.content}\n\n${"=".repeat(60)}\n`).join("\n");
                  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `historial-prompts-${new Date().toISOString().split("T")[0]}.txt`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                  toast.success("Historial descargado");
                }} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                <FileDown className="w-3 h-3" /> Descargar todo
              </button>
              <button onClick={clearHistory} className="text-[10px] font-bold text-slate-400 hover:text-rose-600 uppercase tracking-wider flex items-center gap-1">
                <X className="w-3 h-3" /> Vaciar historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ FRAMEWORK C.R.E.F.O. ══════════ */}
      <div className="pt-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
          <Sparkles className="w-4 h-4 text-indigo-500" /> Framework
        </div>
        <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Método C.R.E.F.O.</h3>
        <p className="text-sm text-slate-500 mb-5">Una forma sencilla de estructurar cualquier prompt en 5 bloques. Activa el "Constructor C.R.E.F.O." arriba para construirlo paso a paso.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { key: "C", label: "Contexto", desc: "La situación de partida: quién eres, tu sector y tu punto actual.", ej: "PYME de calzado artesanal, 8 años, venta en tienda física." },
            { key: "R", label: "Rol", desc: "El papel que asignas a la IA para enfocar su respuesta.", ej: "Actúa como consultor de transformación digital." },
            { key: "E", label: "Específicos", desc: "Restricciones y condiciones concretas a cumplir.", ej: "Tono profesional, herramientas menores de 50€/mes." },
            { key: "F", label: "Formato", desc: "Cómo quieres exactamente la salida.", ej: "Tabla con Estrategia, Canal, Acción, Plazo y KPI." },
            { key: "O", label: "Objetivo", desc: "La meta final, medible siempre que se pueda.", ej: "Subir ventas online un 20% en 6 meses." },
          ].map((b) => (
            <Card key={b.key} className="rounded-xl border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 px-4 py-3 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 text-white text-sm font-extrabold">{b.key}</span>
                <span className="text-white font-bold text-sm">{b.label}</span>
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-slate-600 leading-relaxed">{b.desc}</p>
                <p className="text-[11px] text-slate-400 italic border-l-2 border-slate-200 pl-2">{b.ej}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <button
          onClick={() => { setCrefoMode(true); window.scrollTo({ top: 0, behavior: "smooth" }); toast.success("Constructor C.R.E.F.O. activado"); }}
          className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
        >
          <Sparkles className="w-4 h-4" /> Construir un prompt con C.R.E.F.O.
        </button>
      </div>

      {/* ══════════ GUÍA DE TÉCNICAS DE PROMPT ══════════ */}
      <div className="pt-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
          <BookOpen className="w-4 h-4 text-indigo-500" /> Guía de Técnicas
        </div>
        <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">18 técnicas de prompt</h3>
        <p className="text-sm text-slate-500 mb-6">Pulsa en cualquier técnica para ver su explicación completa, ejemplos y consejos. Usa "Aplicar esta técnica" para generar tu prompt con ese enfoque.</p>

        <div className="space-y-8">
          {(Object.keys(PROMPT_FAMILIES) as PromptTechnique["family"][]).map((familyKey) => {
            const family = PROMPT_FAMILIES[familyKey];
            const techniques = PROMPT_TECHNIQUES.filter((t) => t.family === familyKey);
            if (techniques.length === 0) return null;
            return (
              <div key={familyKey}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full",
                    family.color === "indigo" && "bg-indigo-100 text-indigo-700",
                    family.color === "purple" && "bg-purple-100 text-purple-700",
                    family.color === "cyan" && "bg-cyan-100 text-cyan-700",
                    family.color === "amber" && "bg-amber-100 text-amber-700",
                  )}>{family.label}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {techniques.map((tech) => {
                    const isExpanded = expandedTechnique === tech.id;
                    const isActive = selectedTechnique === tech.id;
                    return (
                      <Card key={tech.id} className={cn("rounded-xl border shadow-sm overflow-hidden transition-all",
                        isExpanded ? "md:col-span-2 lg:col-span-3" : "",
                        isActive ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200")}>
                        <button onClick={() => setExpandedTechnique(isExpanded ? null : tech.id)}
                          className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{tech.name}</span>
                              {isActive && <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
                            </div>
                            {!isExpanded && <p className="text-xs text-slate-500 mt-0.5">{tech.short}</p>}
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-slate-400 flex-shrink-0 transition-transform", isExpanded && "rotate-180")} />
                        </button>

                        {isExpanded && (
                          <CardContent className="px-4 pb-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-slate-50 rounded-lg p-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                                  <Lightbulb className="w-3.5 h-3.5" /> ¿Qué es?
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">{tech.what}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-600 uppercase tracking-wider mb-1">
                                  <Target className="w-3.5 h-3.5" /> ¿Para qué?
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">{tech.useFor}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1">
                                  <Clock className="w-3.5 h-3.5" /> ¿Cuándo?
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">{tech.when}</p>
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Ejemplos prácticos</div>
                              <div className="flex flex-wrap gap-2">
                                {tech.examples.map((ex, i) => (
                                  <button key={i} onClick={() => { setTopic(ex); setSelectedTechnique(tech.id); toast.success("Ejemplo cargado en el objetivo"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                                    className="text-xs text-slate-700 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-lg px-3 py-1.5 transition-colors text-left">
                                    {ex}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">
                                  <ThumbsUp className="w-3.5 h-3.5" /> Ventajas
                                </div>
                                <ul className="space-y-1">
                                  {tech.advantages.map((a, i) => (
                                    <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-emerald-500">+</span> {a}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Limitaciones
                                </div>
                                <ul className="space-y-1">
                                  {tech.limitations.map((l, i) => (
                                    <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-amber-500">–</span> {l}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="bg-indigo-50 border-l-4 border-indigo-300 rounded-r-lg p-3">
                              <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">Consejo práctico</div>
                              <p className="text-xs text-slate-700">{tech.tip}</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Button onClick={() => { setSelectedTechnique(tech.id); setCrefoMode(false); window.scrollTo({ top: 0, behavior: "smooth" }); toast.success(`Técnica "${tech.name}" activada`); }}
                                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-widest text-xs h-11">
                                <Sparkles className="w-4 h-4 mr-2" /> Aplicar esta técnica
                              </Button>
                              <Button onClick={() => {
                                  setSelectedTechnique(tech.id);
                                  setCrefoMode(true);
                                  if (!crefoEspecificos.trim()) setCrefoEspecificos(`Aplica la técnica ${tech.name}: ${tech.short}`);
                                  if (!crefoObjetivo.trim() && tech.examples[0]) setCrefoObjetivo(tech.examples[0]);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                  toast.success(`C.R.E.F.O. + ${tech.name}`);
                                }}
                                variant="outline"
                                className="w-full rounded-xl border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold uppercase tracking-widest text-xs h-11">
                                <Sparkles className="w-4 h-4 mr-2" /> Construir con C.R.E.F.O.
                              </Button>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
