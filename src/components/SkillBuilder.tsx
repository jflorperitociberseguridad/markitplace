import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Star, Trash2, Copy, Check, Bot, X, Save, Library,
  RefreshCcw, Download, Upload, Pencil, Package, FileCode2, BookMarked,
  ChevronRight, ChevronLeft, Wrench, Target, MessageSquare, Sparkles,
  CheckCircle2, AlertTriangle, FlaskConical, Eye, Wand2, ListChecks, Play,
  Globe, ShieldCheck, ShieldAlert, ExternalLink, ArrowDownToLine, TrendingUp, Flame, Award, History,
} from "lucide-react";
import { DB, SavedPrompt } from "../types";
import { getAIConfig } from "../aiConfig";
import { isUnlocked } from "../auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SkillBuilderProps {
  db: DB;
  updateDb: (db: DB) => void;
}

const SKILL_TYPES = [
  { id: "documentos", nombre: "Documentos", emoji: "📄", desc: "Generar DOCX, PPTX, PDF, XLSX", color: "from-blue-500 to-cyan-600", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "creativo", nombre: "Creativo y Diseño", emoji: "🎨", desc: "Arte, plantillas visuales, landing pages", color: "from-pink-500 to-rose-600", badge: "bg-pink-100 text-pink-700 border-pink-200" },
  { id: "desarrollo", nombre: "Desarrollo Técnico", emoji: "⚙️", desc: "Código, testing, scripts, MCP", color: "from-slate-600 to-slate-800", badge: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "empresa", nombre: "Empresa y Comunicación", emoji: "💼", desc: "Propuestas, emails, informes", color: "from-emerald-500 to-teal-600", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "personal", nombre: "Flujo Personal", emoji: "🔁", desc: "Automatizar tareas repetidas propias", color: "from-amber-500 to-orange-600", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "marca", nombre: "Marca Cibermedida", emoji: "🏷️", desc: "Identidad navy/cyan, Arial, A4", color: "from-indigo-500 to-purple-600", badge: "bg-indigo-100 text-indigo-700 border-indigo-200" },
];

function typeOf(id: string) {
  return SKILL_TYPES.find(t => t.id === id) || SKILL_TYPES[SKILL_TYPES.length - 1];
}
function extractSkillMd(text: string): string | null {
  const m = text.match(/```(?:markdown|md|yaml)?\n([\s\S]*?)```/);
  return m ? m[1].trim() : text.includes("name:") && text.includes("description:") ? text.trim() : null;
}
function parseJSON(text: string): any | null {
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { return null; }
}
// Validación de estructura
function validateSkill(content: string) {
  const checks = [
    { label: "Tiene frontmatter (---)", ok: /^---[\s\S]*?---/.test(content.trim()) },
    { label: "Campo 'name'", ok: /name:\s*\S+/.test(content) },
    { label: "Campo 'description'", ok: /description:\s*\S+/.test(content) },
    { label: "name en minúsculas con guiones", ok: /name:\s*[a-z0-9-]+/.test(content) },
    { label: "Cuerpo bajo 500 líneas", ok: content.split("\n").length < 500 },
    { label: "Descripción con contexto de uso", ok: /description:[^\n]{40,}/.test(content) },
  ];
  return checks;
}

const PHASES = [
  { id: 0, label: "Tipo", icon: Wrench },
  { id: 1, label: "Intención", icon: Target },
  { id: 2, label: "Generar", icon: Sparkles },
  { id: 3, label: "Optimizar", icon: Wand2 },
  { id: 4, label: "Pruebas", icon: FlaskConical },
  { id: 5, label: "Empaquetar", icon: Package },
];

export function SkillBuilder({ db, updateDb }: SkillBuilderProps) {
  const [tab, setTab] = useState<"biblioteca" | "constructor" | "explorar">("biblioteca");
  const [autoFixing, setAutoFixing] = useState(false);
  const [similarSkills, setSimilarSkills] = useState<any[] | null>(null);
  const [checkingSimilar, setCheckingSimilar] = useState(false);

  // Biblioteca
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("todas");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", type: "documentos", description: "", content: "" });

  // Constructor por fases
  const [phase, setPhase] = useState(0);
  const [skillType, setSkillType] = useState("");
  const [intent, setIntent] = useState({ what: "", when: "", output: "", resources: "" });
  const [generatedSkill, setGeneratedSkill] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<any>(null);
  const [testsResult, setTestsResult] = useState<any>(null);
  const [testRunResults, setTestRunResults] = useState<any[]>([]);
  const [runningTest, setRunningTest] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const skills = db.skills || [];

  const safeUpdate = (newDb: DB) => {
    if (!isUnlocked()) { toast.error("Desbloquea la consola en Configuración para guardar"); return false; }
    updateDb(newDb); return true;
  };

  // ── Biblioteca: guardar ──
  const createSkill = (title: string, type: string, content: string, description = "") => {
    if (!title.trim() || !content.trim()) { toast.error("Faltan nombre o contenido"); return false; }
    const skill: SavedPrompt = {
      id: Math.random().toString(36).substr(2, 9),
      title: title.trim(), content: content.trim(),
      tags: [description.trim()].filter(Boolean),
      isFavorite: false, createdAt: Date.now(), type: "advanced", category: type,
    };
    return safeUpdate({ ...db, skills: [skill, ...skills] });
  };
  const submitForm = () => {
    if (createSkill(form.title, form.type, form.content, form.description)) {
      setShowForm(false); setForm({ title: "", type: "documentos", description: "", content: "" });
      toast.success("Skill guardada");
    }
  };
  const toggleFav = (id: string) => safeUpdate({ ...db, skills: skills.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s) });
  const deleteSkill = (id: string) => { if (window.confirm("¿Eliminar esta skill?")) { if (safeUpdate({ ...db, skills: skills.filter(s => s.id !== id) })) toast.success("Eliminada"); } };
  const saveEdit = (id: string) => {
    const current = skills.find(s => s.id === id);
    if (!current) return;
    if (current.content === editContent) { setEditingId(null); return; }
    const newVersions = [{ content: current.content, savedAt: Date.now() }, ...(current.versions || [])].slice(0, 10);
    if (safeUpdate({ ...db, skills: skills.map(s => s.id === id ? { ...s, content: editContent, versions: newVersions } : s) })) {
      setEditingId(null);
      toast.success("Guardado (versión anterior conservada en el historial)");
    }
  };
  const restoreVersion = (id: string, version: { content: string; savedAt: number }) => {
    const current = skills.find(s => s.id === id);
    if (!current) return;
    const newVersions = [{ content: current.content, savedAt: Date.now() }, ...(current.versions || []).filter(v => v.savedAt !== version.savedAt)].slice(0, 10);
    if (safeUpdate({ ...db, skills: skills.map(s => s.id === id ? { ...s, content: version.content, versions: newVersions } : s) })) {
      toast.success("Versión restaurada");
      setHistoryId(null);
    }
  };
  const copyContent = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); toast.success("Copiado"); };

  const downloadMd = (skill: SavedPrompt) => {
    const blob = new Blob([skill.content], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "SKILL.md"; a.click(); URL.revokeObjectURL(a.href);
    toast.success("SKILL.md descargado");
  };
  const downloadZip = async (name: string, content: string, includeFolders = false) => {
    try {
      const res = await axios.post("/api/skill-package", { name, content, includeFolders }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const folder = name.toLowerCase().replace(/[^a-z0-9-\s]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "skill";
      const a = document.createElement("a"); a.href = url; a.download = `${folder}.zip`; a.click(); URL.revokeObjectURL(url);
      toast.success("Skill empaquetada (.zip)");
    } catch { toast.error("Error al empaquetar"); }
  };
  const exportLibrary = () => {
    const blob = new Blob([JSON.stringify(skills, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `biblioteca-skills-${new Date().toISOString().split("T")[0]}.json`; a.click(); URL.revokeObjectURL(a.href);
    toast.success("Exportada");
  };
  const importLibrary = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as SavedPrompt[];
        if (!Array.isArray(imported)) throw new Error();
        const existing = new Set(skills.map(s => s.id));
        if (safeUpdate({ ...db, skills: [...imported.filter(s => !existing.has(s.id)), ...skills] })) toast.success(`${imported.length} importadas`);
      } catch { toast.error("JSON inválido"); }
    };
    reader.readAsText(file);
  };

  // ── Constructor por fases ──
  const resetBuilder = () => {
    setPhase(0); setSkillType(""); setIntent({ what: "", when: "", output: "", resources: "" });
    setGeneratedSkill(""); setOptimizeResult(null); setTestsResult(null); setPreviewMode(false);
  };

  const generateSkill = async () => {
    if (!intent.what.trim() || !intent.when.trim()) { toast.error("Completa al menos qué hace y cuándo se activa"); return; }
    setLoading("generate");
    try {
      const { provider, model } = getAIConfig();
      const intentText = `QUÉ DEBE HACER: ${intent.what}\nCUÁNDO SE ACTIVA (triggers): ${intent.when}\nFORMATO DE SALIDA: ${intent.output || "no especificado"}\nRECURSOS ADICIONALES: ${intent.resources || "ninguno"}`;
      const res = await axios.post("/api/skill-generate", { intent: intentText, skillType, provider, model });
      const md = extractSkillMd(res.data.skill) || res.data.skill;
      setGeneratedSkill(md);
      setPhase(2);
      toast.success("SKILL.md generado");
    } catch (e: any) {
      toast.error("Error al generar", { description: e.response?.data?.details || e.message });
    } finally { setLoading(null); }
  };

  const optimizeDescription = async () => {
    if (!generatedSkill) return;
    setLoading("optimize");
    try {
      const { provider, model } = getAIConfig();
      const res = await axios.post("/api/skill-optimize-description", { skillContent: generatedSkill, provider, model });
      const parsed = parseJSON(res.data.result);
      if (parsed) setOptimizeResult(parsed);
      else toast.error("No se pudo interpretar la optimización");
    } catch (e: any) {
      toast.error("Error al optimizar", { description: e.response?.data?.details || e.message });
    } finally { setLoading(null); }
  };

  const applyOptimizedDescription = () => {
    if (!optimizeResult?.descripcionOptimizada) return;
    const updated = generatedSkill.replace(/description:\s*[^\n]+/, `description: ${optimizeResult.descripcionOptimizada}`);
    setGeneratedSkill(updated);
    toast.success("Descripción optimizada aplicada");
  };

  // Función auxiliar para parsear JSON que puede venir con backticks
  const parseJSON = (text: string) => {
    try {
      const clean = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      return JSON.parse(clean);
    } catch { return null; }
  };

  // Ejecutar todos los casos de prueba automáticamente
  const runAllTests = async () => {
    if (!testsResult?.casos || !generatedSkill) return;
    const { provider, model } = getAIConfig();
    const results: any[] = [];

    for (let i = 0; i < testsResult.casos.length; i++) {
      const c = testsResult.casos[i];
      setRunningTest(c.id);
      try {
        const res = await axios.post("/api/skill-run-test", {
          skillContent: generatedSkill,
          testPrompt: c.prompt,
          expectedResult: c.resultadoEsperado,
          provider, model,
        });
        const evalData = parseJSON(res.data.evaluation);
        results.push({
          id: c.id,
          prompt: c.prompt,
          expected: c.resultadoEsperado,
          response: res.data.response,
          evaluation: evalData || { puntuacion: 0, veredicto: "ERROR", cumple: false, observaciones: "No se pudo evaluar", sugerenciaMejora: null },
        });
      } catch (e: any) {
        results.push({
          id: c.id,
          prompt: c.prompt,
          expected: c.resultadoEsperado,
          response: "",
          evaluation: { puntuacion: 0, veredicto: "ERROR", cumple: false, observaciones: e.response?.data?.details || e.message, sugerenciaMejora: null },
        });
      }
      setTestRunResults([...results]);
    }
    setRunningTest(null);
    toast.success("Pruebas completadas");
  };

  const generateTests = async () => {
    if (!generatedSkill) return;
    setLoading("tests");
    try {
      const { provider, model } = getAIConfig();
      const res = await axios.post("/api/skill-tests", { skillContent: generatedSkill, provider, model });
      const parsed = parseJSON(res.data.result);
      if (parsed) setTestsResult(parsed);
      else toast.error("No se pudieron generar los casos");
    } catch (e: any) {
      toast.error("Error en casos de prueba", { description: e.response?.data?.details || e.message });
    } finally { setLoading(null); }
  };

  const saveGeneratedSkill = () => {
    const nameMatch = generatedSkill.match(/name:\s*([^\n]+)/);
    const title = nameMatch ? nameMatch[1].trim() : "nueva-skill";
    if (createSkill(title, skillType, generatedSkill, "Creada con Skill Creator")) {
      toast.success("Skill guardada en la biblioteca");
      setTab("biblioteca");
      resetBuilder();
    }
  };

  // Comprueba en skills.sh (vía skills-api) si ya existe algo similar a lo descrito en "qué debe hacer"
  const checkSimilarSkills = async () => {
    const query = intent.what.trim().split(/\s+/).slice(0, 6).join(" "); // primeras palabras como query
    if (query.length < 3) {
      toast.error("Describe primero qué debe hacer la skill (pregunta 1)");
      return;
    }
    setCheckingSimilar(true);
    setSimilarSkills(null);
    try {
      const res = await axios.get(`/api/skillsh-search?q=${encodeURIComponent(query)}`);
      setSimilarSkills(res.data.data || []);
    } catch (e: any) {
      toast.error("No se pudo comprobar en skills.sh", { description: e.response?.data?.error || e.message });
      setSimilarSkills([]);
    } finally {
      setCheckingSimilar(false);
    }
  };

  // Llama al validador/corrector real del backend (requisitos de skills.sh)
  const autoFixSkill = async () => {
    if (!generatedSkill) return;
    setAutoFixing(true);
    try {
      const res = await axios.post("/api/validate-skill-md", { content: generatedSkill });
      if (res.data.fixedContent && res.data.fixedContent !== generatedSkill) {
        setGeneratedSkill(res.data.fixedContent);
      }
      if (res.data.isValid) {
        toast.success("El SKILL.md cumple los requisitos de skills.sh / Claude");
      } else if (res.data.warnings?.length) {
        toast.success("Se corrigieron problemas automáticamente", { description: res.data.warnings[0] });
      }
      if (res.data.errors?.length) {
        toast.error("Quedan problemas por revisar", { description: res.data.errors[0] });
      }
    } catch (e: any) {
      toast.error("No se pudo validar", { description: e.response?.data?.details || e.message });
    } finally {
      setAutoFixing(false);
    }
  };

  // ── Explorar skills.sh ──
  const [exploreView, setExploreView] = useState<"all-time" | "trending" | "hot" | "official">("trending");
  const [exploreData, setExploreData] = useState<any[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreSearch, setExploreSearch] = useState("");
  const [exploreSearchResults, setExploreSearchResults] = useState<any[] | null>(null);
  const [exploreSearchLoading, setExploreSearchLoading] = useState(false);
  const [exploreDetail, setExploreDetail] = useState<any | null>(null);
  const [exploreDetailLoading, setExploreDetailLoading] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [catalogStats, setCatalogStats] = useState<any | null>(null);
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);

  const loadLeaderboard = async (view: typeof exploreView) => {
    setExploreLoading(true);
    setExploreError(null);
    setExploreSearchResults(null);
    try {
      const res = await axios.get(`/api/skillsh-leaderboard?view=${view}&per_page=20`);
      setExploreData(res.data.data || []);
    } catch (e: any) {
      setExploreError(e.response?.data?.error || "No se pudo conectar con skills.sh");
    } finally {
      setExploreLoading(false);
    }
  };

  const runExploreSearch = async () => {
    if (exploreSearch.trim().length < 2) { toast.error("Escribe al menos 2 caracteres"); return; }
    setExploreSearchLoading(true);
    setExploreError(null);
    try {
      const res = await axios.get(`/api/skillsh-search?q=${encodeURIComponent(exploreSearch.trim())}`);
      setExploreSearchResults(res.data.data || []);
    } catch (e: any) {
      setExploreError(e.response?.data?.error || "No se pudo buscar en skills.sh");
    } finally {
      setExploreSearchLoading(false);
    }
  };

  const openExploreDetail = async (source: string, slug: string) => {
    setExploreDetailLoading(true);
    setExploreDetail(null);
    try {
      const res = await axios.get(`/api/skillsh-detail/${source}/${slug}`);
      setExploreDetail(res.data);
    } catch (e: any) {
      toast.error("No se pudo cargar el detalle", { description: e.response?.data?.error || e.message });
    } finally {
      setExploreDetailLoading(false);
    }
  };

  const importAsReference = (detail: any) => {
    const title = `${detail.id.split("/").pop()}-referencia`;
    if (createSkill(title, "desarrollo", detail.skillMd, `Importada de skills.sh como referencia: ${detail.url}`)) {
      toast.success("Importada a tu biblioteca como referencia. Adáptala antes de usarla.");
      setTab("biblioteca");
    }
  };

  const loadCatalogStats = async () => {
    try {
      const res = await axios.get("/api/skillsh-status");
      setCatalogStats(res.data);
    } catch { /* silencioso: no es crítico para la exploración */ }
  };

  const refreshCatalog = async () => {
    setRefreshingCatalog(true);
    try {
      await axios.post("/api/skillsh-refresh");
      toast.success("Refresco del catálogo lanzado. Puede tardar un par de minutos en completarse.");
      setTimeout(loadCatalogStats, 5000);
    } catch (e: any) {
      toast.error("No se pudo lanzar el refresco", { description: e.response?.data?.error || e.message });
    } finally {
      setRefreshingCatalog(false);
    }
  };

  useEffect(() => {
    if (tab === "explorar" && exploreData.length === 0 && !exploreLoading) {
      loadLeaderboard(exploreView);
      loadCatalogStats();
    }
  }, [tab]);

  // ── Filtrado biblioteca ──
  const filtered = skills.filter(s => {
    if (onlyFavs && !s.isFavorite) return false;
    if (typeFilter !== "todas" && s.category !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.title.toLowerCase().includes(q) && !s.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const typeCounts = SKILL_TYPES.map(t => ({ ...t, count: skills.filter(s => s.category === t.id).length }));
  const validation = generatedSkill ? validateSkill(generatedSkill) : [];
  const validCount = validation.filter(v => v.ok).length;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-700">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
              <Wrench className="w-3 h-3" /> Skill Creator
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Constructor de Skills</h2>
            <p className="text-sm text-slate-400 mt-1">Metodología oficial de Anthropic: intención → generar → optimizar → probar → empaquetar</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab("biblioteca")} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", tab === "biblioteca" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "bg-white/10 text-slate-300 hover:bg-white/20")}>
              <Library className="w-4 h-4" /> Biblioteca
              {skills.length > 0 && <span className="bg-white/20 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{skills.length}</span>}
            </button>
            <button onClick={() => { setTab("constructor"); }} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", tab === "constructor" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "bg-white/10 text-slate-300 hover:bg-white/20")}>
              <Wand2 className="w-4 h-4" /> Skill Creator
            </button>
            <button onClick={() => setTab("explorar")} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", tab === "explorar" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "bg-white/10 text-slate-300 hover:bg-white/20")}>
              <Globe className="w-4 h-4" /> Explorar skills.sh
            </button>
          </div>
        </div>
      </div>

      {/* ══════════ CONSTRUCTOR POR FASES ══════════ */}
      {tab === "constructor" && (
        <div className="space-y-6">
          {/* Barra de fases */}
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-3 overflow-x-auto">
            {PHASES.map((p, i) => {
              const Icon = p.icon;
              const done = phase > p.id;
              const active = phase === p.id;
              return (
                <div key={p.id} className="flex items-center flex-shrink-0">
                  <button
                    onClick={() => { if (p.id <= phase) setPhase(p.id); }}
                    disabled={p.id > phase}
                    className={cn("flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
                      active ? "bg-indigo-600 text-white" : done ? "text-emerald-600" : "text-slate-300")}
                  >
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                      active ? "bg-white/20" : done ? "bg-emerald-100" : "bg-slate-100")}>
                      {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">{p.label}</span>
                  </button>
                  {i < PHASES.length - 1 && <ChevronRight className="w-4 h-4 text-slate-200 mx-1" />}
                </div>
              );
            })}
          </div>

          {/* FASE 0: Tipo */}
          {phase === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">¿Qué tipo de skill vas a crear?</h3>
                <p className="text-sm text-slate-500">El tipo ajusta cómo se genera el SKILL.md.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SKILL_TYPES.map(t => (
                  <button key={t.id} onClick={() => { setSkillType(t.id); setPhase(1); }}
                    className="group flex flex-col gap-3 p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-indigo-300 hover:shadow-lg transition-all text-left">
                    <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl", t.color)}>{t.emoji}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{t.nombre}</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FASE 1: Intención */}
          {phase === 1 && (
            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Target className="w-4 h-4" />
                  <span className="text-sm font-bold uppercase tracking-widest">Captura de Intención · {typeOf(skillType).emoji} {typeOf(skillType).nombre}</span>
                </div>
              </div>
              <CardContent className="p-5 space-y-4">
                <p className="text-xs text-slate-500">Responde las 4 preguntas clave de la metodología de Anthropic. Cuanto más concreto, mejor será la skill.</p>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">1. ¿Qué debe permitir hacer la skill? *</Label>
                  <Textarea value={intent.what} onChange={e => setIntent({ ...intent, what: e.target.value })} placeholder="Ej: Generar manuales formativos en DOCX con la identidad de Cibermedida, con portada, índice, capítulos y ejercicios." className="rounded-xl min-h-[70px]" />
                  <button onClick={checkSimilarSkills} disabled={checkingSimilar} className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
                    {checkingSimilar ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    Comprobar si ya existe algo similar en skills.sh
                  </button>
                  {similarSkills !== null && (
                    similarSkills.length === 0 ? (
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> No se encontró nada similar. Buen punto de partida.</p>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
                        <p className="text-[10px] font-bold text-amber-700 uppercase flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Ya existen {similarSkills.length} skills similares — revísalas antes de seguir</p>
                        {similarSkills.slice(0, 3).map((s: any, i: number) => (
                          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="flex items-center justify-between text-[11px] text-amber-800 hover:text-amber-950 bg-white/60 rounded-lg px-2 py-1">
                            <span>{s.name} <span className="text-amber-500">· {s.source}</span></span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    )
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">2. ¿Cuándo debe activarse? (frases del usuario) *</Label>
                  <Textarea value={intent.when} onChange={e => setIntent({ ...intent, when: e.target.value })} placeholder="Ej: Cuando el usuario diga 'crea un manual', 'genera material formativo', 'manual para desempleados', 'curso completo'..." className="rounded-xl min-h-[70px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">3. ¿Formato de salida esperado?</Label>
                  <Input value={intent.output} onChange={e => setIntent({ ...intent, output: e.target.value })} placeholder="Ej: Archivo DOCX de 60 páginas en A4, navy/cyan, Arial" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">4. ¿Recursos adicionales? (scripts, plantillas, referencias)</Label>
                  <Input value={intent.resources} onChange={e => setIntent({ ...intent, resources: e.target.value })} placeholder="Ej: Un script Node.js con docx, una plantilla de portada" className="rounded-xl" />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setPhase(0)} className="rounded-xl text-[10px] font-bold uppercase"><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                  <Button onClick={generateSkill} disabled={loading === "generate"} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase">
                    {loading === "generate" ? <RefreshCcw className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} Generar SKILL.md
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* FASE 2: Generar / editar */}
          {phase === 2 && (
            <div className="space-y-4">
              <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <FileCode2 className="w-4 h-4" />
                    <span className="text-sm font-bold uppercase tracking-widest">SKILL.md generado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPreviewMode(!previewMode)} className="flex items-center gap-1 text-[10px] font-bold text-white/80 hover:text-white uppercase">
                      <Eye className="w-3.5 h-3.5" /> {previewMode ? "Editar" : "Vista previa"}
                    </button>
                  </div>
                </div>
                <CardContent className="p-0">
                  {previewMode ? (
                    <div className="prose prose-sm max-w-none p-5 markdown-body text-xs max-h-[400px] overflow-auto">
                      <ReactMarkdown>{generatedSkill}</ReactMarkdown>
                    </div>
                  ) : (
                    <Textarea value={generatedSkill} onChange={e => setGeneratedSkill(e.target.value)} className="rounded-none border-0 font-mono text-xs min-h-[400px] focus:ring-0" />
                  )}
                </CardContent>
              </Card>

              {/* Validación */}
              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><ListChecks className="w-4 h-4" /> Validación de estructura</span>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-[9px]", validCount === validation.length ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{validCount}/{validation.length} comprobaciones</Badge>
                      <Button size="sm" onClick={autoFixSkill} disabled={autoFixing} className="h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-[9px] font-bold uppercase px-2">
                        {autoFixing ? <RefreshCcw className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                        Validar y corregir
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2">Comprueba y corrige automáticamente los requisitos exigidos por skills.sh / Claude: frontmatter YAML, name en kebab-case y description.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {validation.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {v.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                        <span className={v.ok ? "text-slate-600" : "text-amber-700"}>{v.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setPhase(1)} className="rounded-xl text-[10px] font-bold uppercase"><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={saveGeneratedSkill} className="rounded-xl text-[10px] font-bold uppercase"><Save className="w-4 h-4 mr-1" /> Guardar ya</Button>
                  <Button onClick={() => { setPhase(3); optimizeDescription(); }} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase">
                    <Wand2 className="w-4 h-4 mr-1" /> Optimizar descripción
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* FASE 3: Optimizar descripción */}
          {phase === 3 && (
            <div className="space-y-4">
              <Card className="rounded-2xl border-indigo-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 flex items-center gap-2 text-white">
                  <Wand2 className="w-4 h-4" />
                  <span className="text-sm font-bold uppercase tracking-widest">Optimización de la descripción (triggering)</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  {loading === "optimize" ? (
                    <div className="flex items-center justify-center py-8"><RefreshCcw className="w-6 h-6 animate-spin text-indigo-500" /></div>
                  ) : optimizeResult ? (
                    <>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase">Descripción actual</Label>
                        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100">{optimizeResult.descripcionActual}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-emerald-600 uppercase">Descripción optimizada</Label>
                        <p className="text-xs text-slate-700 bg-emerald-50 rounded-lg p-3 border border-emerald-200">{optimizeResult.descripcionOptimizada}</p>
                      </div>
                      {optimizeResult.mejoras?.length > 0 && (
                        <div><Label className="text-[10px] font-bold text-slate-400 uppercase">Mejoras</Label>
                          <ul className="mt-1 space-y-0.5">{optimizeResult.mejoras.map((m: string, i: number) => <li key={i} className="text-xs text-slate-600 flex gap-2"><span className="text-indigo-400">›</span>{m}</li>)}</ul>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {optimizeResult.triggersPositivos?.length > 0 && (
                          <div className="bg-emerald-50/50 rounded-lg border border-emerald-100 p-3">
                            <Label className="text-[9px] font-bold text-emerald-600 uppercase">✓ Debería activar</Label>
                            <ul className="mt-1 space-y-1">{optimizeResult.triggersPositivos.map((t: string, i: number) => <li key={i} className="text-[11px] text-slate-600">"{t}"</li>)}</ul>
                          </div>
                        )}
                        {optimizeResult.triggersNegativos?.length > 0 && (
                          <div className="bg-rose-50/50 rounded-lg border border-rose-100 p-3">
                            <Label className="text-[9px] font-bold text-rose-600 uppercase">✗ No debería activar</Label>
                            <ul className="mt-1 space-y-1">{optimizeResult.triggersNegativos.map((t: string, i: number) => <li key={i} className="text-[11px] text-slate-600">"{t}"</li>)}</ul>
                          </div>
                        )}
                      </div>
                      <Button onClick={applyOptimizedDescription} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold uppercase w-full">
                        <Check className="w-4 h-4 mr-1" /> Aplicar descripción optimizada
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <Button onClick={optimizeDescription} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase">Reintentar optimización</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setPhase(2)} className="rounded-xl text-[10px] font-bold uppercase"><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                <Button onClick={() => { setPhase(4); generateTests(); }} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase">
                  <FlaskConical className="w-4 h-4 mr-1" /> Casos de prueba
                </Button>
              </div>
            </div>
          )}

          {/* FASE 4: Casos de prueba */}
          {phase === 4 && (
            <div className="space-y-4">
              {/* Casos de prueba */}
              <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4" />
                    <span className="text-sm font-bold uppercase tracking-widest">Casos de prueba</span>
                  </div>
                  {testsResult?.casos && (
                    <Button
                      onClick={runAllTests}
                      disabled={runningTest !== null}
                      size="sm"
                      className="rounded-lg bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold uppercase h-8"
                    >
                      {runningTest !== null ? (
                        <><RefreshCcw className="w-3 h-3 mr-1 animate-spin" /> Ejecutando caso {runningTest}...</>
                      ) : (
                        <><Play className="w-3 h-3 mr-1" /> Ejecutar pruebas</>
                      )}
                    </Button>
                  )}
                </div>
                <CardContent className="p-5 space-y-3">
                  <p className="text-xs text-slate-500">Prompts realistas para validar la skill. Pulsa "Ejecutar pruebas" para que la IA los ejecute y evalúe automáticamente.</p>
                  {loading === "tests" ? (
                    <div className="flex items-center justify-center py-8"><RefreshCcw className="w-6 h-6 animate-spin text-purple-500" /></div>
                  ) : testsResult?.casos ? (
                    testsResult.casos.map((c: any) => {
                      const result = testRunResults.find((r: any) => r.id === c.id);
                      const isRunning = runningTest === c.id;
                      const scoreColor = result ? (
                        result.evaluation.puntuacion >= 4 ? "bg-emerald-500" :
                        result.evaluation.puntuacion >= 3 ? "bg-amber-500" : "bg-rose-500"
                      ) : "bg-slate-300";
                      const verdictColor = result ? (
                        result.evaluation.puntuacion >= 4 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                        result.evaluation.puntuacion >= 3 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-rose-700 bg-rose-50 border-rose-200"
                      ) : "";

                      return (
                        <div key={c.id} className={cn("rounded-xl border p-4 space-y-2 transition-all", isRunning ? "border-purple-300 bg-purple-50/50 animate-pulse" : result ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50")}>
                          {/* Header del caso */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0", scoreColor)}>
                                {result ? result.evaluation.puntuacion : c.id}
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Caso {c.id}</span>
                              {isRunning && <RefreshCcw className="w-3 h-3 animate-spin text-purple-500" />}
                            </div>
                            {result && (
                              <Badge className={cn("text-[9px] font-bold border", verdictColor)}>
                                {result.evaluation.cumple ? "✓" : "✗"} {result.evaluation.veredicto} ({result.evaluation.puntuacion}/5)
                              </Badge>
                            )}
                          </div>

                          {/* Prompt y esperado */}
                          <p className="text-xs text-slate-700 italic">"{c.prompt}"</p>
                          <p className="text-[10px] text-slate-500"><span className="font-bold">Esperado:</span> {c.resultadoEsperado}</p>

                          {/* Resultado de ejecución */}
                          {result && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <div>
                                <p className="text-[9px] font-bold text-indigo-600 uppercase mb-1">Respuesta obtenida</p>
                                <pre className="whitespace-pre-wrap text-[11px] font-mono text-slate-600 bg-slate-50 rounded-lg border border-slate-100 p-3 max-h-40 overflow-auto">{result.response}</pre>
                              </div>
                              <div className={cn("rounded-lg border p-3 space-y-1", verdictColor)}>
                                <p className="text-[10px] font-bold uppercase">Evaluación automática</p>
                                <p className="text-xs">{result.evaluation.observaciones}</p>
                                {result.evaluation.sugerenciaMejora && (
                                  <p className="text-[10px] italic">💡 {result.evaluation.sugerenciaMejora}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6"><Button onClick={generateTests} className="rounded-xl bg-purple-600 hover:bg-purple-700 text-[10px] font-bold uppercase">Generar casos</Button></div>
                  )}
                </CardContent>
              </Card>

              {/* Resumen de resultados */}
              {testRunResults.length > 0 && (
                <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-800 px-5 py-3 flex items-center gap-2 text-white">
                    <ListChecks className="w-4 h-4" />
                    <span className="text-sm font-bold uppercase tracking-widest">Resumen de validación</span>
                  </div>
                  <CardContent className="p-5">
                    {(() => {
                      const total = testRunResults.length;
                      const passed = testRunResults.filter((r: any) => r.evaluation.cumple).length;
                      const avgScore = (testRunResults.reduce((a: number, r: any) => a + (r.evaluation.puntuacion || 0), 0) / total).toFixed(1);
                      const allGood = passed === total;
                      return (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-slate-50 rounded-xl p-3">
                              <div className="text-2xl font-extrabold text-slate-900">{avgScore}</div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase">Puntuación media</div>
                            </div>
                            <div className={cn("rounded-xl p-3", allGood ? "bg-emerald-50" : "bg-amber-50")}>
                              <div className={cn("text-2xl font-extrabold", allGood ? "text-emerald-700" : "text-amber-700")}>{passed}/{total}</div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase">Casos aprobados</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3">
                              <div className={cn("text-2xl font-extrabold", allGood ? "text-emerald-700" : "text-amber-700")}>
                                {allGood ? "✅" : "⚠️"}
                              </div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase">{allGood ? "Lista" : "Revisar skill"}</div>
                            </div>
                          </div>
                          {!allGood && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-700">Algunos casos no pasaron. Revisa las sugerencias de mejora y vuelve a la Fase 2 para ajustar la skill.</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setPhase(3)} className="rounded-xl text-[10px] font-bold uppercase"><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                {testRunResults.some((r: any) => !r.evaluation.cumple) && (
                  <Button variant="outline" onClick={() => { setPhase(2); toast.info("Ajusta la skill y vuelve a ejecutar las pruebas"); }} className="rounded-xl text-[10px] font-bold uppercase border-amber-300 text-amber-700 hover:bg-amber-50">
                    <Wand2 className="w-4 h-4 mr-1" /> Volver a editar
                  </Button>
                )}
                <Button onClick={() => setPhase(5)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase"><Package className="w-4 h-4 mr-1" /> Empaquetar</Button>
              </div>
            </div>
          )}

          {/* FASE 5: Empaquetar */}
          {phase === 5 && (
            <div className="space-y-4">
              <Card className="rounded-2xl border-emerald-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 flex items-center gap-2 text-white">
                  <Package className="w-4 h-4" />
                  <span className="text-sm font-bold uppercase tracking-widest">Empaquetar e instalar</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3 bg-emerald-50 rounded-lg border border-emerald-200 p-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-700">Tu skill está lista. Descárgala como SKILL.md suelto o empaquetada en un .zip con la estructura de carpeta correcta para instalar.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button onClick={() => { const b = new Blob([generatedSkill], { type: "text/markdown" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "SKILL.md"; a.click(); }} variant="outline" className="rounded-xl text-[10px] font-bold uppercase h-12">
                      <Download className="w-4 h-4 mr-1" /> SKILL.md
                    </Button>
                    <Button onClick={() => { const n = generatedSkill.match(/name:\s*([^\n]+)/)?.[1] || "skill"; downloadZip(n, generatedSkill, false); }} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold uppercase h-12">
                      <Package className="w-4 h-4 mr-1" /> .zip simple
                    </Button>
                    <Button onClick={() => { const n = generatedSkill.match(/name:\s*([^\n]+)/)?.[1] || "skill"; downloadZip(n, generatedSkill, true); }} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[10px] font-bold uppercase h-12">
                      <Package className="w-4 h-4 mr-1" /> .zip + carpetas
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400">El ".zip + carpetas" incluye scripts/, references/ y assets/ vacías para que añadas recursos.</p>
                  <Button onClick={saveGeneratedSkill} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase w-full h-11">
                    <Save className="w-4 h-4 mr-1" /> Guardar en la biblioteca y terminar
                  </Button>
                </CardContent>
              </Card>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setPhase(4)} className="rounded-xl text-[10px] font-bold uppercase"><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                <Button variant="outline" onClick={resetBuilder} className="rounded-xl text-[10px] font-bold uppercase">Crear otra skill</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ BIBLIOTECA ══════════ */}
      {/* ══════════ EXPLORAR SKILLS.SH ══════════ */}
      {tab === "explorar" && (
        <div className="space-y-5">
          {exploreDetail ? (
            /* ── Vista de detalle de una skill ── */
            <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <FileCode2 className="w-4 h-4" />
                  <span className="text-sm font-bold uppercase tracking-widest">{exploreDetail.id}</span>
                </div>
                <button onClick={() => setExploreDetail(null)} className="text-white/70 hover:text-white text-[10px] font-bold uppercase flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" /> Volver
                </button>
              </div>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-lg font-extrabold text-slate-900">{exploreDetail.installs || "—"}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Instalaciones</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-lg font-extrabold text-slate-900">{exploreDetail.stars || "—"}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Estrellas</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 col-span-2 md:col-span-1">
                    <div className="text-[11px] font-bold text-slate-700 truncate">{exploreDetail.repo}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Repositorio</div>
                  </div>
                  <a href={exploreDetail.url} target="_blank" rel="noreferrer" className="bg-indigo-50 rounded-xl p-3 flex flex-col items-center justify-center hover:bg-indigo-100 transition-colors">
                    <ExternalLink className="w-4 h-4 text-indigo-600 mb-1" />
                    <div className="text-[9px] font-bold text-indigo-600 uppercase">Ver en skills.sh</div>
                  </a>
                </div>

                {exploreDetail.audits?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {exploreDetail.audits.map((a: any, i: number) => (
                      <Badge key={i} className={cn("text-[9px] font-bold border flex items-center gap-1",
                        a.status === "Pass" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        a.status === "Warn" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-rose-50 text-rose-700 border-rose-200")}>
                        {a.status === "Pass" ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                        {a.provider}: {a.status}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <a href={exploreDetail.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors w-fit">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Auditorías de seguridad no disponibles aquí — ver en skills.sh
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Instalación (terminal / Claude Code)</p>
                  <code className="text-[11px] text-slate-700 break-all">{exploreDetail.installCommand}</code>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Contenido del SKILL.md</p>
                  <div className="prose prose-sm max-w-none markdown-body text-xs bg-white border border-slate-100 rounded-lg p-4 max-h-[420px] overflow-auto">
                    <ReactMarkdown>{exploreDetail.skillMd}</ReactMarkdown>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Esto es una skill de un tercero. Úsala como inspiración o punto de partida, revisa su contenido y adáptala antes de usarla en tus cursos o entregables.</p>
                </div>

                <Button onClick={() => importAsReference(exploreDetail)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase w-full">
                  <ArrowDownToLine className="w-4 h-4 mr-1" /> Importar a mi biblioteca como referencia
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Buscador */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    placeholder="Buscar skills públicas (ej: pdf, react, design...)"
                    value={exploreSearch}
                    onChange={e => setExploreSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && runExploreSearch()}
                    className="rounded-xl pl-9"
                  />
                </div>
                <Button onClick={runExploreSearch} disabled={exploreSearchLoading} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase">
                  {exploreSearchLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
                {exploreSearchResults && (
                  <Button variant="outline" onClick={() => { setExploreSearchResults(null); setExploreSearch(""); }} className="rounded-xl text-[10px] font-bold uppercase">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {!exploreSearchResults && (
                <>
                  {/* Selector de vista */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-2">
                      {[
                        { id: "trending", label: "Trending", icon: TrendingUp },
                        { id: "hot", label: "Hot", icon: Flame },
                        { id: "all-time", label: "Todos los tiempos", icon: Library },
                        { id: "official", label: "Oficiales", icon: Award },
                      ].map(v => (
                        <button key={v.id} onClick={() => { setExploreView(v.id as any); loadLeaderboard(v.id as any); }}
                          className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border-2 transition-all", exploreView === v.id ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                          <v.icon className="w-3.5 h-3.5" /> {v.label}
                        </button>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={refreshCatalog} disabled={refreshingCatalog} className="rounded-xl text-[10px] font-bold uppercase h-8">
                      {refreshingCatalog ? <RefreshCcw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5 mr-1" />}
                      Actualizar catálogo
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Catálogo propio (self-hosted skills-api): {catalogStats ? `${catalogStats.totalSkills?.toLocaleString("es-ES")} skills de ${catalogStats.totalSources?.toLocaleString("es-ES")} repositorios` : "cargando estadísticas..."}.
                    {catalogStats?.scrapedAt && ` Última actualización: ${new Date(catalogStats.scrapedAt).toLocaleString("es-ES")}.`}
                  </p>
                </>
              )}

              {exploreError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700">{exploreError}</p>
                </div>
              )}

              {/* Resultados de búsqueda */}
              {exploreSearchResults && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{exploreSearchResults.length} resultados para "{exploreSearch}"</p>
                  {exploreSearchResults.length === 0 && (
                    <p className="text-sm text-slate-400 py-6 text-center">Sin resultados (la búsqueda cubre las skills de portada, trending y oficiales).</p>
                  )}
                  {exploreSearchResults.map((item: any, i: number) => (
                    <button key={i} onClick={() => openExploreDetail(item.source, item.slug)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm transition-all text-left">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.name}</p>
                        <p className="text-[10px] text-slate-400">{item.source}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-[9px] bg-slate-100 text-slate-600">{item.installs} installs</Badge>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Leaderboard */}
              {!exploreSearchResults && (
                exploreLoading ? (
                  <div className="flex items-center justify-center py-12"><RefreshCcw className="w-6 h-6 animate-spin text-indigo-500" /></div>
                ) : (
                  <div className="space-y-2">
                    {exploreData.map((item: any, i: number) => (
                      <button key={i} onClick={() => openExploreDetail(item.source, item.slug)}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm transition-all text-left">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{item.name}</p>
                            <p className="text-[10px] text-slate-400">{item.source}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="text-[9px] bg-slate-100 text-slate-600">{item.installs} installs</Badge>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </button>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {tab === "biblioteca" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {typeCounts.map(t => (
              <button key={t.id} onClick={() => setTypeFilter(typeFilter === t.id ? "todas" : t.id)}
                className={cn("rounded-xl border-2 p-3 text-center transition-all", typeFilter === t.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300")}>
                <div className="text-xl">{t.emoji}</div>
                <div className="text-lg font-extrabold text-slate-900">{t.count}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase leading-tight">{t.nombre}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input placeholder="Buscar skill..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="rounded-xl pl-9" />
            </div>
            <button onClick={() => setOnlyFavs(!onlyFavs)} className={cn("flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border-2 transition-all", onlyFavs ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-500 hover:border-amber-200")}>
              <Star className={cn("w-4 h-4", onlyFavs && "fill-amber-400 text-amber-400")} /> Favoritos
            </button>
            <button onClick={exportLibrary} className="flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border-2 border-slate-200 text-slate-500 hover:border-slate-300 transition-all">
              <Download className="w-4 h-4" /> Exportar
            </button>
            <label className="flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border-2 border-slate-200 text-slate-500 hover:border-slate-300 transition-all cursor-pointer">
              <input type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && importLibrary(e.target.files[0])} />
              <Upload className="w-4 h-4" /> Importar
            </label>
            <Button onClick={() => setShowForm(!showForm)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase tracking-widest h-10">
              <Plus className="w-4 h-4 mr-1" /> Manual
            </Button>
          </div>

          {showForm && (
            <Card className="rounded-2xl border-2 border-indigo-200 shadow-lg bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white"><FileCode2 className="w-4 h-4" /><span className="text-sm font-bold uppercase tracking-widest">Skill manual</span></div>
                <button onClick={() => setShowForm(false)} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <CardContent className="p-5 space-y-4 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nombre *</Label>
                    <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="mi-skill" className="rounded-xl bg-white font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tipo *</Label>
                    <div className="flex flex-wrap gap-1">
                      {SKILL_TYPES.map(t => (
                        <button key={t.id} onClick={() => setForm({ ...form, type: t.id })} className={cn("text-[10px] font-bold px-2 py-1 rounded-lg border transition-all", form.type === t.id ? t.badge : "bg-white border-slate-200 text-slate-400")}>{t.emoji} {t.nombre}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contenido del SKILL.md *</Label>
                  <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder={"---\nname: mi-skill\ndescription: ...\n---\n\n# Mi Skill"} className="rounded-xl bg-white min-h-[200px] font-mono text-xs" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={submitForm} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase tracking-widest flex-1"><Save className="w-4 h-4 mr-1" /> Guardar</Button>
                  <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl text-[10px] font-bold uppercase tracking-widest">Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
              <BookMarked className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">{skills.length === 0 ? "Sin skills guardadas" : "Sin resultados"}</p>
              <p className="text-sm text-slate-400 mt-1">{skills.length === 0 ? "Usa el Skill Creator para crear tu primera skill." : "Cambia los filtros."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map(s => {
                const t = typeOf(s.category);
                return (
                  <Card key={s.id} className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden hover:shadow-md transition-all">
                    <div className={cn("px-4 py-2.5 flex items-center justify-between border-b", t.badge)}>
                      <div className="flex items-center gap-2"><span className="text-base">{t.emoji}</span><span className="text-xs font-bold">{t.nombre}</span></div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleFav(s.id)} className="p-1.5 rounded-lg hover:bg-white/40" title="Favorito"><Star className={cn("w-3.5 h-3.5", s.isFavorite ? "fill-amber-400 text-amber-400" : "text-current opacity-50")} /></button>
                        <button onClick={() => copyContent(s.content, s.id)} className="p-1.5 rounded-lg hover:bg-white/40" title="Copiar">{copiedId === s.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>
                        <button onClick={() => { setEditingId(editingId === s.id ? null : s.id); setEditContent(s.content); }} className="p-1.5 rounded-lg hover:bg-white/40" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                        {(s.versions?.length || 0) > 0 && (
                          <button onClick={() => setHistoryId(historyId === s.id ? null : s.id)} className="p-1.5 rounded-lg hover:bg-white/40" title="Historial de versiones">
                            <History className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => downloadMd(s)} className="p-1.5 rounded-lg hover:bg-white/40" title="SKILL.md"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => downloadZip(s.title, s.content, true)} className="p-1.5 rounded-lg hover:bg-white/40" title="Empaquetar .zip"><Package className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteSkill(s.id)} className="p-1.5 rounded-lg hover:bg-white/40 text-rose-500" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <h4 className="font-bold text-slate-900 text-sm font-mono">{s.title}</h4>
                      {s.tags.filter(Boolean).length > 0 && <p className="text-xs text-slate-500">{s.tags.filter(Boolean).join(" · ")}</p>}
                      {editingId === s.id ? (
                        <div className="space-y-2">
                          <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="rounded-lg min-h-[160px] font-mono text-xs" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit(s.id)} className="rounded-lg text-[10px] font-bold uppercase bg-indigo-600 hover:bg-indigo-700"><Save className="w-3 h-3 mr-1" /> Guardar</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="rounded-lg text-[10px] font-bold uppercase">Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap text-[11px] font-mono text-slate-600 bg-slate-50 rounded-lg border border-slate-100 p-3 max-h-44 overflow-auto">{s.content}</pre>
                      )}
                      {historyId === s.id && (s.versions?.length || 0) > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1.5">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Versiones anteriores</p>
                          {s.versions!.map((v, vi) => (
                            <div key={vi} className="flex items-center justify-between bg-white rounded-lg px-2 py-1.5 border border-slate-100">
                              <span className="text-[10px] text-slate-500">{new Date(v.savedAt).toLocaleString("es-ES")}</span>
                              <button onClick={() => restoreVersion(s.id, v)} className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 uppercase">Restaurar</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-[9px] text-slate-400">{new Date(s.createdAt).toLocaleString("es-ES")}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
