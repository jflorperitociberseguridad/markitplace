import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Braces, Plus, Trash2, Sparkles, Globe, ShieldCheck, Library, Search, Star,
  Pencil, Save, Copy, Download, CheckCircle2, AlertTriangle, RefreshCw,
  X, BookMarked, ChevronRight, Wand2, FileJson, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import axios from "axios";
import { DB, SavedPrompt } from "../types";
import { getAIConfig } from "../aiConfig";
import { isUnlocked } from "../auth";

interface JsonBuilderProps { db: DB; updateDb: (db: DB) => void; }

type FieldType = "string" | "number" | "boolean" | "object" | "array";
interface Field { id: string; key: string; type: FieldType; value: string; children?: Field[]; }

const TEMPLATES = [
  { id: "webhook", name: "Webhook n8n / Make", json: { event: "matricula_nueva", data: { nombre: "Ana Pérez", email: "ana@example.com", curso: "IA Aplicada" }, timestamp: "2026-06-24T10:00:00Z" } },
  { id: "config", name: "Configuración PM2", json: { name: "mi-app", script: "server.ts", cwd: "/var/www/mi-app", env: { NODE_ENV: "production", PORT: "3000" } } },
  { id: "appsscript", name: "Manifiesto Apps Script", json: { timeZone: "Europe/Madrid", dependencies: {}, exceptionLogging: "STACKDRIVER", runtimeVersion: "V8" } },
];

function newField(): Field {
  return { id: Math.random().toString(36).slice(2, 9), key: "", type: "string", value: "" };
}

function fieldsToObject(fields: Field[]): any {
  const obj: any = {};
  for (const f of fields) {
    if (!f.key) continue;
    if (f.type === "object") obj[f.key] = fieldsToObject(f.children || []);
    else if (f.type === "array") {
      try { obj[f.key] = JSON.parse(f.value || "[]"); } catch { obj[f.key] = []; }
    } else if (f.type === "number") obj[f.key] = Number(f.value) || 0;
    else if (f.type === "boolean") obj[f.key] = f.value === "true";
    else obj[f.key] = f.value;
  }
  return obj;
}

export function JsonBuilder({ db, updateDb }: JsonBuilderProps) {
  const [tab, setTab] = useState<"constructor" | "generador" | "url" | "validador" | "biblioteca">("constructor");

  // Constructor visual
  const [fields, setFields] = useState<Field[]>([newField()]);

  // Generador IA
  const [genDescription, setGenDescription] = useState("");
  const [genResult, setGenResult] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genValid, setGenValid] = useState<boolean | null>(null);

  // Extraer de URL
  const [url, setUrl] = useState("");
  const [urlInstruction, setUrlInstruction] = useState("");
  const [urlResult, setUrlResult] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlValid, setUrlValid] = useState<boolean | null>(null);
  const [urlSourceTitle, setUrlSourceTitle] = useState("");

  // Validador
  const [rawJson, setRawJson] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationOk, setValidationOk] = useState<boolean | null>(null);

  // Guardar en biblioteca
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [pendingSaveContent, setPendingSaveContent] = useState("");

  // Biblioteca
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const jsons = db.jsons || [];

  const safeUpdate = (newDb: DB) => {
    if (!isUnlocked()) { toast.error("Desbloquea la consola en Configuración para guardar"); return false; }
    updateDb(newDb);
    return true;
  };

  // ── Constructor visual ──
  const addField = (path: Field[], setPath: (f: Field[]) => void) => setPath([...path, newField()]);
  const updateField = (list: Field[], id: string, patch: Partial<Field>): Field[] =>
    list.map((f) => (f.id === id ? { ...f, ...patch } : f.children ? { ...f, children: updateField(f.children, id, patch) } : f));
  const removeField = (list: Field[], id: string): Field[] =>
    list.filter((f) => f.id !== id).map((f) => (f.children ? { ...f, children: removeField(f.children, id) } : f));
  const addChildField = (list: Field[], parentId: string): Field[] =>
    list.map((f) => (f.id === parentId ? { ...f, children: [...(f.children || []), newField()] } : f.children ? { ...f, children: addChildField(f.children, parentId) } : f));

  const constructorJson = JSON.stringify(fieldsToObject(fields), null, 2);

  const renderField = (f: Field, depth = 0): React.ReactElement => (
    <div key={f.id} className="space-y-2" style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-2">
        <Input value={f.key} onChange={(e) => setFields(updateField(fields, f.id, { key: e.target.value }))}
          placeholder="clave" className="rounded-lg h-9 text-xs flex-1" />
        <select value={f.type} onChange={(e) => setFields(updateField(fields, f.id, { type: e.target.value as FieldType, value: "", children: e.target.value === "object" ? [] : undefined }))}
          className="rounded-lg h-9 text-xs border border-slate-200 px-2 bg-white">
          <option value="string">Texto</option>
          <option value="number">Número</option>
          <option value="boolean">Booleano</option>
          <option value="object">Objeto</option>
          <option value="array">Array (JSON)</option>
        </select>
        {f.type === "object" ? (
          <Button size="sm" variant="outline" onClick={() => setFields(addChildField(fields, f.id))} className="h-9 rounded-lg text-[10px] font-bold uppercase px-2">
            <Plus className="w-3 h-3" />
          </Button>
        ) : f.type === "boolean" ? (
          <select value={f.value} onChange={(e) => setFields(updateField(fields, f.id, { value: e.target.value }))}
            className="rounded-lg h-9 text-xs border border-slate-200 px-2 bg-white flex-1">
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <Input value={f.value} onChange={(e) => setFields(updateField(fields, f.id, { value: e.target.value }))}
            placeholder={f.type === "array" ? '["a","b"]' : "valor"} className="rounded-lg h-9 text-xs flex-1 font-mono" />
        )}
        <Button size="sm" variant="ghost" onClick={() => setFields(removeField(fields, f.id))} className="h-9 px-2 text-rose-400 hover:text-rose-600">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      {f.type === "object" && (f.children || []).map((c) => renderField(c, depth + 1))}
    </div>
  );

  // ── Generador IA ──
  const runGenerate = async () => {
    if (!genDescription.trim()) { toast.error("Describe qué JSON necesitas"); return; }
    setGenLoading(true); setGenResult(""); setGenValid(null);
    try {
      const { provider, model } = getAIConfig();
      const res = await axios.post("/api/json-generate", { description: genDescription, provider, model });
      setGenResult(res.data.json); setGenValid(res.data.isValid);
    } catch (e: any) {
      toast.error("Error generando el JSON", { description: e.response?.data?.details || e.message });
    } finally { setGenLoading(false); }
  };

  // ── Extraer de URL ──
  const runExtractUrl = async () => {
    if (!url.trim()) { toast.error("Pega una URL"); return; }
    setUrlLoading(true); setUrlResult(""); setUrlValid(null);
    try {
      const { provider, model } = getAIConfig();
      const res = await axios.post("/api/json-extract-url", { url: url.trim(), instruction: urlInstruction, provider, model });
      setUrlResult(res.data.json); setUrlValid(res.data.isValid); setUrlSourceTitle(res.data.sourceTitle || "");
    } catch (e: any) {
      toast.error("No se pudo extraer", { description: e.response?.data?.error || e.message });
    } finally { setUrlLoading(false); }
  };

  // ── Validador ──
  const runValidate = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setRawJson(JSON.stringify(parsed, null, 2));
      setValidationOk(true); setValidationError(null);
      toast.success("JSON válido");
    } catch (e: any) {
      setValidationOk(false); setValidationError(e.message);
    }
  };
  const minifyJson = () => {
    try { setRawJson(JSON.stringify(JSON.parse(rawJson))); } catch { toast.error("Corrige el JSON antes de minificarlo"); }
  };

  // ── Guardar en biblioteca ──
  const openSaveForm = (content: string) => {
    if (!content.trim()) { toast.error("No hay contenido para guardar"); return; }
    setPendingSaveContent(content);
    setShowSaveForm(true);
  };
  const confirmSave = () => {
    try { JSON.parse(pendingSaveContent); } catch { toast.error("El contenido no es un JSON válido"); return; }
    const title = saveTitle.trim() || `JSON ${new Date().toLocaleDateString("es-ES")}`;
    const entry: SavedPrompt = {
      id: Math.random().toString(36).substr(2, 9), title, content: pendingSaveContent,
      tags: [tab], isFavorite: false, createdAt: Date.now(), type: "json", category: tab,
    };
    if (safeUpdate({ ...db, jsons: [entry, ...jsons] })) {
      setShowSaveForm(false); setSaveTitle(""); toast.success("Guardado en la biblioteca");
    }
  };

  // ── Acciones biblioteca ──
  const toggleFav = (id: string) => safeUpdate({ ...db, jsons: jsons.map((j) => (j.id === id ? { ...j, isFavorite: !j.isFavorite } : j)) });
  const deleteEntry = (id: string) => {
    if (!window.confirm("¿Eliminar este JSON de la biblioteca?")) return;
    if (safeUpdate({ ...db, jsons: jsons.filter((j) => j.id !== id) })) toast.success("Eliminado");
  };
  const saveEdit = (id: string) => {
    try { JSON.parse(editContent); } catch { toast.error("JSON no válido"); return; }
    if (safeUpdate({ ...db, jsons: jsons.map((j) => (j.id === id ? { ...j, content: editContent } : j)) })) { setEditingId(null); toast.success("Guardado"); }
  };
  const copyEntry = (text: string, id: string) => {
    navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); toast.success("Copiado");
  };
  const downloadEntry = (entry: SavedPrompt) => {
    const blob = new Blob([entry.content], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${entry.title}.json`; a.click(); URL.revokeObjectURL(a.href);
  };

  const filtered = jsons.filter((j) => {
    if (onlyFavs && !j.isFavorite) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!j.title.toLowerCase().includes(q) && !j.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const TABS = [
    { id: "constructor", label: "Constructor", icon: Braces },
    { id: "generador", label: "Generador IA", icon: Sparkles },
    { id: "url", label: "Extraer de URL", icon: Globe },
    { id: "validador", label: "Validador", icon: ShieldCheck },
    { id: "biblioteca", label: "Biblioteca", icon: Library },
  ] as const;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-700">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 p-6 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(217,119,6,0.18),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">
              <FileJson className="w-3 h-3" /> Constructor de JSON
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">JSON Builder</h2>
            <p className="text-sm text-slate-400 mt-1">Construye, genera, extrae y valida estructuras JSON</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all", tab === t.id ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "bg-white/10 text-slate-300 hover:bg-white/20")}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
                {t.id === "biblioteca" && jsons.length > 0 && <span className="bg-white/20 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{jsons.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════ CONSTRUCTOR VISUAL ══════════ */}
      {tab === "constructor" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Campos</span>
                <Button size="sm" onClick={() => setFields([...fields, newField()])} className="rounded-lg bg-amber-600 hover:bg-amber-700 text-[10px] font-bold uppercase h-8">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Añadir campo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
              {fields.map((f) => renderField(f))}
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-900 px-5 py-3">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Vista previa</span>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="p-5 text-[11px] font-mono text-emerald-400 bg-slate-900 min-h-[300px] max-h-[440px] overflow-auto whitespace-pre-wrap">{constructorJson}</pre>
            </CardContent>
          </Card>
          <div className="lg:col-span-2 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(constructorJson); toast.success("Copiado"); }} className="rounded-xl text-[10px] font-bold uppercase h-10">
              <Copy className="w-3.5 h-3.5 mr-2" /> Copiar
            </Button>
            <Button onClick={() => openSaveForm(constructorJson)} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-[10px] font-bold uppercase h-10">
              <Save className="w-3.5 h-3.5 mr-2" /> Guardar en biblioteca
            </Button>
          </div>
          <div className="lg:col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Plantillas rápidas</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => { navigator.clipboard.writeText(JSON.stringify(t.json, null, 2)); toast.success(`Plantilla "${t.name}" copiada al portapapeles`); }}
                  className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors">
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ GENERADOR IA ══════════ */}
      {tab === "generador" && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Describe el JSON que necesitas</Label>
              <Textarea value={genDescription} onChange={(e) => setGenDescription(e.target.value)}
                placeholder="Ej: un usuario con nombre, email y lista de cursos matriculados con fecha de inscripción"
                className="rounded-xl min-h-[100px]" />
              <Button onClick={runGenerate} disabled={genLoading} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-[10px] font-bold uppercase h-10">
                {genLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />} Generar JSON
              </Button>
            </CardContent>
          </Card>
          {genResult && (
            <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-900 px-5 py-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Resultado</span>
                <Badge className={cn("text-[9px]", genValid ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>
                  {genValid ? "JSON válido" : "Revisar formato"}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="p-5 text-[11px] font-mono text-emerald-400 bg-slate-900 max-h-[400px] overflow-auto whitespace-pre-wrap">{genResult}</pre>
              </CardContent>
              <div className="p-3 flex gap-2 bg-slate-50 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(genResult); toast.success("Copiado"); }} className="rounded-lg text-[10px] font-bold uppercase">
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                </Button>
                <Button size="sm" onClick={() => openSaveForm(genResult)} className="rounded-lg bg-amber-600 hover:bg-amber-700 text-[10px] font-bold uppercase">
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Guardar
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ EXTRAER DE URL ══════════ */}
      {tab === "url" && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">URL a analizar</Label>
              <div className="relative">
                <Link2 className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ejemplo.com/pagina" className="rounded-xl pl-9" />
              </div>
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">¿Qué quieres extraer? (opcional)</Label>
              <Textarea value={urlInstruction} onChange={(e) => setUrlInstruction(e.target.value)}
                placeholder="Ej: los productos con su precio y descripción. Si lo dejas vacío, se extrae la estructura general de la página."
                className="rounded-xl min-h-[80px]" />
              <Button onClick={runExtractUrl} disabled={urlLoading} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-[10px] font-bold uppercase h-10">
                {urlLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />} Extraer JSON
              </Button>
              <p className="text-[10px] text-slate-400">Algunas páginas bloquean el acceso automático (protección anti-bot); en ese caso se mostrará un aviso.</p>
            </CardContent>
          </Card>
          {urlResult && (
            <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-900 px-5 py-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">{urlSourceTitle || "Resultado"}</span>
                <Badge className={cn("text-[9px]", urlValid ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>
                  {urlValid ? "JSON válido" : "Revisar formato"}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="p-5 text-[11px] font-mono text-emerald-400 bg-slate-900 max-h-[400px] overflow-auto whitespace-pre-wrap">{urlResult}</pre>
              </CardContent>
              <div className="p-3 flex gap-2 bg-slate-50 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(urlResult); toast.success("Copiado"); }} className="rounded-lg text-[10px] font-bold uppercase">
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                </Button>
                <Button size="sm" onClick={() => openSaveForm(urlResult)} className="rounded-lg bg-amber-600 hover:bg-amber-700 text-[10px] font-bold uppercase">
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Guardar
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ VALIDADOR ══════════ */}
      {tab === "validador" && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Pega tu JSON</span>
              {validationOk !== null && (
                <Badge className={cn("text-[9px] flex items-center gap-1", validationOk ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                  {validationOk ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {validationOk ? "Válido" : "Error de sintaxis"}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Textarea value={rawJson} onChange={(e) => { setRawJson(e.target.value); setValidationOk(null); }}
                placeholder='{"clave": "valor"}' className="rounded-none border-none min-h-[320px] font-mono text-xs p-5" />
            </CardContent>
            {validationError && (
              <div className="bg-rose-50 border-t border-rose-200 p-4 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 font-mono">{validationError}</p>
              </div>
            )}
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button onClick={runValidate} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-[10px] font-bold uppercase h-10">
              <ShieldCheck className="w-4 h-4 mr-2" /> Validar y formatear
            </Button>
            <Button variant="outline" onClick={minifyJson} className="rounded-xl text-[10px] font-bold uppercase h-10">
              Minificar
            </Button>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(rawJson); toast.success("Copiado"); }} disabled={!rawJson} className="rounded-xl text-[10px] font-bold uppercase h-10">
              <Copy className="w-3.5 h-3.5 mr-2" /> Copiar
            </Button>
            <Button onClick={() => openSaveForm(rawJson)} disabled={!rawJson || validationOk === false} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-[10px] font-bold uppercase h-10">
              <Save className="w-3.5 h-3.5 mr-2" /> Guardar en biblioteca
            </Button>
          </div>
        </div>
      )}

      {/* ══════════ BIBLIOTECA ══════════ */}
      {tab === "biblioteca" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input placeholder="Buscar JSON..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="rounded-xl pl-9" />
            </div>
            <button onClick={() => setOnlyFavs(!onlyFavs)} className={cn("flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border-2 transition-all", onlyFavs ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-500 hover:border-amber-200")}>
              <Star className={cn("w-4 h-4", onlyFavs && "fill-amber-400 text-amber-400")} /> Favoritos
            </button>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
              <BookMarked className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">{jsons.length === 0 ? "Biblioteca vacía" : "Sin resultados"}</p>
              <p className="text-sm text-slate-400 mt-1">{jsons.length === 0 ? "Construye, genera o extrae un JSON y guárdalo aquí." : "Prueba a cambiar los filtros."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((j) => (
                <Card key={j.id} className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden hover:shadow-md transition-all">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b bg-amber-50 text-amber-700">
                    <div className="flex items-center gap-2"><Braces className="w-4 h-4" /><span className="text-xs font-bold uppercase">{j.category}</span></div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => toggleFav(j.id)} className="p-1.5 rounded-lg hover:bg-white/60" title="Favorito">
                        <Star className={cn("w-3.5 h-3.5", j.isFavorite ? "fill-amber-400 text-amber-400" : "text-current opacity-50")} />
                      </button>
                      <button onClick={() => copyEntry(j.content, j.id)} className="p-1.5 rounded-lg hover:bg-white/60" title="Copiar">
                        {copiedId === j.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => { setEditingId(editingId === j.id ? null : j.id); setEditContent(j.content); }} className="p-1.5 rounded-lg hover:bg-white/60" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => downloadEntry(j)} className="p-1.5 rounded-lg hover:bg-white/60" title="Descargar .json">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteEntry(j.id)} className="p-1.5 rounded-lg hover:bg-white/60 text-rose-500" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-bold text-slate-900 text-sm">{j.title}</h4>
                    {editingId === j.id ? (
                      <div className="space-y-2">
                        <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="rounded-lg min-h-[140px] font-mono text-xs" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(j.id)} className="rounded-lg text-[10px] font-bold uppercase bg-amber-600 hover:bg-amber-700"><Save className="w-3 h-3 mr-1" /> Guardar</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="rounded-lg text-[10px] font-bold uppercase">Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-[11px] font-mono text-slate-600 bg-slate-50 rounded-lg border border-slate-100 p-3 max-h-36 overflow-auto">{j.content}</pre>
                    )}
                    <p className="text-[9px] text-slate-400">{new Date(j.createdAt).toLocaleString("es-ES")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de guardado */}
      {showSaveForm && (
        <Card className="rounded-xl border-amber-200 bg-amber-50/40 p-4">
          <div className="flex items-center gap-2">
            <Input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder="Nombre del JSON" className="rounded-lg bg-white" />
            <Button onClick={confirmSave} className="rounded-lg bg-amber-600 hover:bg-amber-700 text-[10px] font-bold uppercase h-10 px-4">Guardar</Button>
            <Button variant="ghost" onClick={() => setShowSaveForm(false)} className="h-10 px-2"><X className="w-4 h-4" /></Button>
          </div>
        </Card>
      )}
    </div>
  );
}
