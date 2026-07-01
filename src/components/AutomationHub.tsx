import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Star, Trash2, Code2, Copy, Check, Zap, Bot, Send, X,
  Sparkles, Save, Rocket, Library, MessageSquare, Play, RefreshCcw,
  Download, Upload, Pencil, ChevronRight, Workflow, FileCode2,
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface AutomationHubProps {
  db: DB;
  updateDb: (db: DB) => void;
}
interface Message { role: "user" | "model"; text: string; }

// Plataformas de automatización
const PLATFORMS = [
  { id: "make", label: "Make", emoji: "🔷", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { id: "n8n", label: "n8n", emoji: "🔶", color: "bg-rose-100 text-rose-700 border-rose-200" },
  { id: "zapier", label: "Zapier", emoji: "⚡", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { id: "apps-script", label: "Apps Script", emoji: "📜", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "python", label: "Python", emoji: "🐍", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "otro", label: "Otro", emoji: "⚙️", color: "bg-slate-100 text-slate-700 border-slate-200" },
];

function platformOf(id: string) {
  return PLATFORMS.find(p => p.id === id) || PLATFORMS[PLATFORMS.length - 1];
}

export function AutomationHub({ db, updateDb }: AutomationHubProps) {
  const [tab, setTab] = useState<"boveda" | "arquitecto">("boveda");

  // Bóveda
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("todas");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<Record<string, string>>({});
  const [testLoading, setTestLoading] = useState<string | null>(null);

  // Formulario nuevo script
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", platform: "make", content: "", tags: "" });

  // Arquitecto IA (chat)
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Automatizaciones SEPARADAS de los prompts
  const automations = db.automations || [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isThinking]);

  const safeUpdate = (newDb: DB) => {
    if (!isUnlocked()) {
      toast.error("Desbloquea la consola en Configuración para guardar");
      return false;
    }
    updateDb(newDb);
    return true;
  };

  // ── Guardar nuevo script ──
  const createScript = () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Completa al menos el nombre y el contenido");
      return;
    }
    const tags = form.tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    const script: SavedPrompt = {
      id: Math.random().toString(36).substr(2, 9),
      title: form.title.trim(),
      content: form.content.trim(),
      tags: [form.description.trim(), ...tags].filter(Boolean),
      isFavorite: false,
      createdAt: Date.now(),
      type: "automation",
      category: form.platform,
    };
    const newDb = { ...db, automations: [script, ...automations] };
    if (safeUpdate(newDb)) {
      setShowForm(false);
      setForm({ title: "", description: "", platform: "make", content: "", tags: "" });
      toast.success("Automatización guardada en la bóveda");
    }
  };

  // ── Acciones bóveda ──
  const toggleFav = (id: string) => {
    const newDb = { ...db, automations: automations.map(a => a.id === id ? { ...a, isFavorite: !a.isFavorite } : a) };
    safeUpdate(newDb);
  };
  const deleteScript = (id: string) => {
    if (!window.confirm("¿Eliminar esta automatización?")) return;
    const newDb = { ...db, automations: automations.filter(a => a.id !== id) };
    if (safeUpdate(newDb)) toast.success("Eliminada");
  };
  const saveEdit = (id: string) => {
    const newDb = { ...db, automations: automations.map(a => a.id === id ? { ...a, content: editContent } : a) };
    if (safeUpdate(newDb)) { setEditingId(null); toast.success("Cambios guardados"); }
  };
  const copyContent = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copiado");
  };
  const testScript = async (a: SavedPrompt) => {
    setTestLoading(a.id);
    try {
      const { provider, model } = getAIConfig();
      const res = await axios.post("/api/prompt-tools", { action: "run", prompt: a.content, provider, model });
      setTestOutput(prev => ({ ...prev, [a.id]: res.data.result }));
    } catch (e: any) {
      toast.error("Error al probar", { description: e.response?.data?.details || e.message });
    } finally { setTestLoading(null); }
  };

  const exportVault = () => {
    const blob = new Blob([JSON.stringify(automations, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `boveda-automatizaciones-${new Date().toISOString().split("T")[0]}.json`; a.click();
    URL.revokeObjectURL(a.href); toast.success("Bóveda exportada");
  };
  const importVault = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as SavedPrompt[];
        if (!Array.isArray(imported)) throw new Error();
        const existing = new Set(automations.map(a => a.id));
        const newDb = { ...db, automations: [...imported.filter(a => !existing.has(a.id)), ...automations] };
        if (safeUpdate(newDb)) toast.success(`${imported.length} automatizaciones importadas`);
      } catch { toast.error("Archivo JSON inválido"); }
    };
    reader.readAsText(file);
  };

  // ── Chat arquitecto ──
  const sendMessage = async () => {
    if (!inputText.trim() || isThinking) return;
    const userMsg: Message = { role: "user", text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText(""); setIsThinking(true);
    try {
      const { provider, model } = getAIConfig();
      const res = await axios.post("/api/automation-chat", { messages, text: userMsg.text, provider, model });
      setMessages(prev => [...prev, { role: "model", text: res.data.text || "Error de procesamiento, reinténtalo." }]);
    } catch (e: any) {
      toast.error("Error de conexión con el Arquitecto IA", { description: e.response?.data?.details || e.message });
    } finally { setIsThinking(false); }
  };

  const saveFromChat = (text: string) => {
    setForm({
      title: "Receta del Arquitecto IA",
      description: "Generada por el chat",
      platform: "make",
      content: text,
      tags: "ia-generada",
    });
    setTab("boveda");
    setShowForm(true);
    toast.success("Receta cargada en el formulario — revísala y guárdala");
  };

  const initChat = () => {
    if (messages.length === 0) {
      setMessages([{ role: "model", text: "¡Hola! Soy el Arquitecto de Automatización de Cibermedida. Te ayudo a diseñar flujos de trabajo con Make, n8n, Zapier o Apps Script.\n\n¿Qué proceso quieres automatizar? (Ej: triaje de emails, sincronización con un CRM, reporte de ventas...)" }]);
    }
  };

  // ── Filtrado ──
  const filtered = automations.filter(a => {
    if (onlyFavs && !a.isFavorite) return false;
    if (platformFilter !== "todas" && a.category !== platformFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.content.toLowerCase().includes(q) && !a.tags.some(t => t.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // Conteo por plataforma
  const platformCounts = PLATFORMS.map(p => ({ ...p, count: automations.filter(a => a.category === p.id).length }));

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-700">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-6 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(168,85,247,0.15),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">
              <Workflow className="w-3 h-3" /> Centro de Automatización
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Bóveda de Automatizaciones</h2>
            <p className="text-sm text-slate-400 mt-1">Guarda, organiza y diseña tus flujos de trabajo con IA</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab("boveda")} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", tab === "boveda" ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30" : "bg-white/10 text-slate-300 hover:bg-white/20")}>
              <Library className="w-4 h-4" /> Bóveda
              {automations.length > 0 && <span className="bg-white/20 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{automations.length}</span>}
            </button>
            <button onClick={() => { setTab("arquitecto"); initChat(); }} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", tab === "arquitecto" ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30" : "bg-white/10 text-slate-300 hover:bg-white/20")}>
              <Bot className="w-4 h-4" /> Arquitecto IA
            </button>
          </div>
        </div>
      </div>

      {/* ══════════ BÓVEDA ══════════ */}
      {tab === "boveda" && (
        <div className="space-y-5">
          {/* Resumen por plataforma */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {platformCounts.map(p => (
              <button key={p.id} onClick={() => setPlatformFilter(platformFilter === p.id ? "todas" : p.id)}
                className={cn("rounded-xl border-2 p-3 text-center transition-all", platformFilter === p.id ? "border-purple-400 bg-purple-50" : "border-slate-200 bg-white hover:border-slate-300")}>
                <div className="text-xl">{p.emoji}</div>
                <div className="text-lg font-extrabold text-slate-900">{p.count}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">{p.label}</div>
              </button>
            ))}
          </div>

          {/* Barra de acciones */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input placeholder="Buscar automatización..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="rounded-xl pl-9" />
            </div>
            <button onClick={() => setOnlyFavs(!onlyFavs)} className={cn("flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border-2 transition-all", onlyFavs ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-500 hover:border-amber-200")}>
              <Star className={cn("w-4 h-4", onlyFavs && "fill-amber-400 text-amber-400")} /> Favoritos
            </button>
            <button onClick={exportVault} className="flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border-2 border-slate-200 text-slate-500 hover:border-slate-300 transition-all">
              <Download className="w-4 h-4" /> Exportar
            </button>
            <label className="flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border-2 border-slate-200 text-slate-500 hover:border-slate-300 transition-all cursor-pointer">
              <input type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && importVault(e.target.files[0])} />
              <Upload className="w-4 h-4" /> Importar
            </label>
            <Button onClick={() => setShowForm(!showForm)} className="rounded-xl bg-purple-600 hover:bg-purple-700 text-[10px] font-bold uppercase tracking-widest h-10">
              <Plus className="w-4 h-4 mr-1" /> Nueva
            </Button>
          </div>

          {/* Formulario nuevo script (fondo sólido) */}
          {showForm && (
            <Card className="rounded-2xl border-2 border-purple-200 shadow-lg bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Rocket className="w-4 h-4" />
                  <span className="text-sm font-bold uppercase tracking-widest">Nueva Automatización</span>
                </div>
                <button onClick={() => setShowForm(false)} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <CardContent className="p-5 space-y-4 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nombre *</Label>
                    <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Clasificador de emails entrantes" className="rounded-xl bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Plataforma *</Label>
                    <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                      <SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map(p => <SelectItem key={p.id} value={p.id}>{p.emoji} {p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Descripción breve</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="¿Qué hace esta automatización?" className="rounded-xl bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contenido / Código / Receta *</Label>
                  <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Pega aquí la receta, el flujo, el código o los pasos de la automatización..." className="rounded-xl bg-white min-h-[160px] font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Etiquetas (separadas por coma)</Label>
                  <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="email, crm, ventas" className="rounded-xl bg-white" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={createScript} className="rounded-xl bg-purple-600 hover:bg-purple-700 text-[10px] font-bold uppercase tracking-widest flex-1">
                    <Save className="w-4 h-4 mr-1" /> Guardar en la bóveda
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl text-[10px] font-bold uppercase tracking-widest">Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de automatizaciones */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
              <Workflow className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">{automations.length === 0 ? "Bóveda vacía" : "Sin resultados"}</p>
              <p className="text-sm text-slate-400 mt-1">
                {automations.length === 0 ? "Crea tu primera automatización o pide una al Arquitecto IA." : "Prueba a cambiar los filtros."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map(a => {
                const plat = platformOf(a.category);
                return (
                  <Card key={a.id} className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden hover:shadow-md transition-all">
                    <div className={cn("px-4 py-2.5 flex items-center justify-between border-b", plat.color)}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{plat.emoji}</span>
                        <span className="text-xs font-bold">{plat.label}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleFav(a.id)} className="p-1.5 rounded-lg hover:bg-white/40">
                          <Star className={cn("w-3.5 h-3.5", a.isFavorite ? "fill-amber-400 text-amber-400" : "text-current opacity-50")} />
                        </button>
                        <button onClick={() => copyContent(a.content, a.id)} className="p-1.5 rounded-lg hover:bg-white/40">
                          {copiedId === a.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => { setEditingId(editingId === a.id ? null : a.id); setEditContent(a.content); }} className="p-1.5 rounded-lg hover:bg-white/40">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => testScript(a)} className="p-1.5 rounded-lg hover:bg-white/40">
                          {testLoading === a.id ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => deleteScript(a.id)} className="p-1.5 rounded-lg hover:bg-white/40 text-rose-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <h4 className="font-bold text-slate-900 text-sm">{a.title}</h4>
                      <div className="flex flex-wrap gap-1">
                        {a.tags.filter(Boolean).map((t, i) => (
                          <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{t}</span>
                        ))}
                      </div>
                      {editingId === a.id ? (
                        <div className="space-y-2">
                          <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="rounded-lg min-h-[120px] font-mono text-xs" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit(a.id)} className="rounded-lg text-[10px] font-bold uppercase bg-purple-600 hover:bg-purple-700"><Save className="w-3 h-3 mr-1" /> Guardar</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="rounded-lg text-[10px] font-bold uppercase">Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap text-[11px] font-mono text-slate-600 bg-slate-50 rounded-lg border border-slate-100 p-3 max-h-40 overflow-auto">{a.content}</pre>
                      )}
                      {testOutput[a.id] && (
                        <div className="border-t border-slate-100 pt-2">
                          <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1">Resultado de la prueba</p>
                          <pre className="whitespace-pre-wrap text-[11px] text-slate-700 bg-emerald-50/50 rounded-lg border border-emerald-100 p-3 max-h-40 overflow-auto">{testOutput[a.id]}</pre>
                        </div>
                      )}
                      <p className="text-[9px] text-slate-400">{new Date(a.createdAt).toLocaleString("es-ES")}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ ARQUITECTO IA ══════════ */}
      {tab === "arquitecto" && (
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "420px" }}>
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 flex items-center gap-2">
            <Bot className="w-5 h-5 text-white" />
            <div>
              <p className="text-sm font-bold text-white">Arquitecto de Automatización IA</p>
              <p className="text-[10px] text-white/70">Diseña flujos para Make, n8n, Zapier o Apps Script</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-3", m.role === "user" ? "bg-purple-600 text-white" : "bg-white border border-slate-200 text-slate-700")}>
                  {m.role === "model" ? (
                    <div className="prose prose-sm max-w-none text-xs markdown-body">
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-xs whitespace-pre-wrap">{m.text}</p>
                  )}
                  {m.role === "model" && i > 0 && (
                    <button onClick={() => saveFromChat(m.text)} className="mt-2 flex items-center gap-1 text-[10px] font-bold text-purple-600 hover:text-purple-800 uppercase tracking-widest">
                      <Save className="w-3 h-3" /> Guardar en bóveda
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                  <RefreshCcw className="w-4 h-4 animate-spin text-purple-500" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3 bg-white flex gap-2">
            <Input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Describe el proceso que quieres automatizar..."
              className="rounded-xl flex-1"
              disabled={isThinking}
            />
            <Button onClick={sendMessage} disabled={isThinking || !inputText.trim()} className="rounded-xl bg-purple-600 hover:bg-purple-700 px-4">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
