import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  FileText, Download, Upload, Copy, Trash2, Eye, Code, CheckCircle2,
  Sparkles, RefreshCw, X, FileCheck, Terminal, Library, Search, Star,
  Pencil, Save, BookMarked, FileCode2, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import axios from "axios";
import { DB, SavedPrompt } from "../types";
import { getAIConfig } from "../aiConfig";
import { isUnlocked } from "../auth";
import { Label } from "@/components/ui/label";

interface MarkdownProProps {
  db: DB;
  updateDb: (db: DB) => void;
}

// Lenguajes de destino simplificados a los realmente útiles en el día a día de Cibermedida
const LANGUAGES = [
  { id: "python", name: "Python", icon: <Terminal className="w-4 h-4" />, ext: "py", mime: "text/x-python",
    desc: "Scripts de procesamiento, automatización local" },
  { id: "javascript", name: "JavaScript", icon: <Code className="w-4 h-4" />, ext: "js", mime: "application/javascript",
    desc: "Node.js, automatizaciones web" },
  { id: "appsscript", name: "Apps Script", icon: <FileCode2 className="w-4 h-4" />, ext: "gs", mime: "application/javascript",
    desc: "Automatizar Google Sheets, Docs y Forms" },
];

export function MarkdownDownloader({ db, updateDb }: MarkdownProProps) {
  const [tab, setTab] = useState<"convertir" | "biblioteca">("convertir");

  // Convertir
  const [markdown, setMarkdown] = useState<string>("");
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [isUploading, setIsUploading] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "code">("preview");
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Guardar en biblioteca
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");

  // Biblioteca
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const markdowns = db.markdowns || [];

  const safeUpdate = (newDb: DB) => {
    if (!isUnlocked()) {
      toast.error("Desbloquea la consola en Configuración para guardar");
      return false;
    }
    updateDb(newDb);
    return true;
  };

  // ── Conversión ──
  const handleFileUpload = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post("/api/convert", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMarkdown((prev) => prev + (prev ? "\n\n" : "") + response.data.markdown);
      toast.success("Archivo convertido", { description: `${selectedFile.name} se transformó en Markdown correctamente.` });
      setViewMode("preview");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error de conversión", { description: "No se pudo procesar este archivo. Comprueba el formato." });
    } finally {
      setIsUploading(false);
      setDragActive(false);
    }
  };

  const transformToCode = async (silent = false) => {
    if (!markdown) return null;
    setIsTransforming(true);
    try {
      const currentLang = LANGUAGES.find((l) => l.id === selectedLanguage) || LANGUAGES[0];
      const { provider, model } = getAIConfig();
      const response = await axios.post("/api/transform", { markdown, language: currentLang.name, provider, model });
      const code = response.data.code || "";
      setGeneratedCode(code);
      if (!silent) {
        setViewMode("code");
        toast.success(`Script en ${currentLang.name} generado`, { description: "Revísalo antes de descargarlo o ejecutarlo." });
      }
      return code;
    } catch (error: any) {
      console.error("Transformation error:", error);
      if (!silent) toast.error("Error al generar el script", { description: error.response?.data?.details || error.message });
      return null;
    } finally {
      setIsTransforming(false);
    }
  };

  const downloadBlob = (content: string, filename: string, mimeType: string) => {
    if (!content || content.trim() === "") {
      toast.error("No hay contenido para descargar");
      return;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 100);
    toast.success("Descarga iniciada", { description: filename });
  };

  const downloadMarkdown = () => {
    const fileName = file ? file.name.split(".")[0] : "cibermedida_export";
    downloadBlob(markdown, `${fileName}.md`, "text/markdown");
  };

  const downloadCode = async () => {
    const currentLang = LANGUAGES.find((l) => l.id === selectedLanguage) || LANGUAGES[0];
    const fileName = file ? file.name.split(".")[0] : "cibermedida_script";
    if (generatedCode) {
      downloadBlob(generatedCode, `${fileName}.${currentLang.ext}`, currentLang.mime);
    } else {
      toast.loading("Generando script...", { id: "export-transform" });
      const code = await transformToCode(true);
      toast.dismiss("export-transform");
      if (code) downloadBlob(code, `${fileName}.${currentLang.ext}`, currentLang.mime);
      else toast.error("No se pudo generar el script");
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  }, []);

  const copyToClipboard = () => {
    const textToCopy = viewMode === "code" ? generatedCode : markdown;
    navigator.clipboard.writeText(textToCopy);
    toast.success("Copiado al portapapeles");
  };

  const clearWorkspace = () => {
    setMarkdown(""); setGeneratedCode(""); setFile(null);
    toast.info("Espacio de trabajo despejado");
  };

  // ── Guardar en biblioteca ──
  const saveToLibrary = () => {
    if (!markdown.trim()) { toast.error("No hay contenido para guardar"); return; }
    const title = saveTitle.trim() || (file ? file.name.split(".")[0] : `Conversión ${new Date().toLocaleDateString("es-ES")}`);
    const entry: SavedPrompt = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      content: markdown,
      tags: [file ? file.name : "texto manual"],
      isFavorite: false,
      createdAt: Date.now(),
      type: "markdown",
      category: file ? file.name.split(".").pop() || "md" : "manual",
    };
    if (safeUpdate({ ...db, markdowns: [entry, ...markdowns] })) {
      setShowSaveForm(false);
      setSaveTitle("");
      toast.success("Guardado en la biblioteca");
    }
  };

  // ── Acciones biblioteca ──
  const toggleFav = (id: string) => {
    safeUpdate({ ...db, markdowns: markdowns.map((m) => (m.id === id ? { ...m, isFavorite: !m.isFavorite } : m)) });
  };
  const deleteEntry = (id: string) => {
    if (!window.confirm("¿Eliminar esta conversión de la biblioteca?")) return;
    if (safeUpdate({ ...db, markdowns: markdowns.filter((m) => m.id !== id) })) toast.success("Eliminada");
  };
  const saveEdit = (id: string) => {
    if (safeUpdate({ ...db, markdowns: markdowns.map((m) => (m.id === id ? { ...m, content: editContent } : m)) })) {
      setEditingId(null);
      toast.success("Cambios guardados");
    }
  };
  const copyEntry = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copiado");
  };
  const downloadEntry = (entry: SavedPrompt) => {
    downloadBlob(entry.content, `${entry.title}.md`, "text/markdown");
  };
  const loadIntoConverter = (entry: SavedPrompt) => {
    setMarkdown(entry.content);
    setGeneratedCode("");
    setFile(null);
    setViewMode("preview");
    setTab("convertir");
    toast.success("Cargado en el conversor");
  };

  const filtered = markdowns.filter((m) => {
    if (onlyFavs && !m.isFavorite) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!m.title.toLowerCase().includes(q) && !m.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-700">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 p-6 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(14,165,168,0.18),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">
              <FileText className="w-3 h-3" /> MarkDown Pro
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Conversor de Documentos</h2>
            <p className="text-sm text-slate-400 mt-1">Convierte PDF, Word, Excel e imágenes a Markdown, y genera scripts a partir del contenido</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab("convertir")} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", tab === "convertir" ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30" : "bg-white/10 text-slate-300 hover:bg-white/20")}>
              <Upload className="w-4 h-4" /> Convertir
            </button>
            <button onClick={() => setTab("biblioteca")} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", tab === "biblioteca" ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30" : "bg-white/10 text-slate-300 hover:bg-white/20")}>
              <Library className="w-4 h-4" /> Biblioteca
              {markdowns.length > 0 && <span className="bg-white/20 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{markdowns.length}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════ CONVERTIR ══════════ */}
      {tab === "convertir" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Dropzone & opciones */}
            <div className="lg:col-span-4 space-y-5">
              <label
                htmlFor="file-upload"
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={cn(
                  "relative flex flex-col items-center justify-center min-h-[320px] border-2 border-dashed rounded-2xl transition-all cursor-pointer overflow-hidden p-8 text-center",
                  dragActive ? "border-cyan-500 bg-cyan-50/50 shadow-inner" : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300"
                )}
              >
                <input id="file-upload" type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-5">
                    <div className="relative">
                      <RefreshCw className="w-12 h-12 text-cyan-600 animate-spin" />
                      <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-400 animate-pulse" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">Convirtiendo documento…</p>
                  </div>
                ) : file ? (
                  <div className="flex flex-col items-center gap-3 animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600">
                      <FileCheck className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate max-w-[220px]">{file.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{(file.size / 1024).toFixed(1)} KB</p>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); setFile(null); }} className="text-slate-400 hover:text-rose-600 text-[10px] font-bold uppercase">
                      <X className="w-3.5 h-3.5 mr-1" /> Quitar
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4 text-cyan-600">
                      <Upload className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">Arrastra un documento aquí</h4>
                    <p className="text-xs text-slate-400 mt-2">o haz clic para elegirlo</p>
                    <div className="flex items-center gap-1.5 mt-4 flex-wrap justify-center">
                      {["PDF", "DOCX", "XLSX", "Imágenes"].map((t) => (
                        <span key={t} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{t}</span>
                      ))}
                    </div>
                  </>
                )}
                {dragActive && (
                  <div className="absolute inset-0 bg-cyan-600/10 backdrop-blur-[2px] flex items-center justify-center border-4 border-cyan-500 rounded-2xl m-1">
                    <div className="bg-white px-5 py-2.5 rounded-xl shadow-2xl text-xs font-bold text-cyan-600 uppercase">Suelta el archivo aquí</div>
                  </div>
                )}
              </label>

              <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-600 to-slate-800 px-4 py-2.5 flex items-center gap-2 text-white">
                  <Code className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Generar script</span>
                </div>
                <CardContent className="p-4 space-y-3">
                  <p className="text-[11px] text-slate-500">Convierte el contenido en Markdown a un script que automatiza su procesamiento.</p>
                  <div className="space-y-2">
                    {LANGUAGES.map((lang) => (
                      <button key={lang.id} onClick={() => setSelectedLanguage(lang.id)}
                        className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border-2",
                          selectedLanguage === lang.id ? "border-cyan-400 bg-cyan-50" : "border-slate-100 hover:border-slate-200")}>
                        <span className={cn("flex-shrink-0", selectedLanguage === lang.id ? "text-cyan-600" : "text-slate-400")}>{lang.icon}</span>
                        <span>
                          <span className="block text-xs font-bold text-slate-800">{lang.name}</span>
                          <span className="block text-[10px] text-slate-400">{lang.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <Button onClick={() => transformToCode()} disabled={!markdown || isTransforming}
                    className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold uppercase tracking-widest text-[10px] h-10">
                    {isTransforming ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                    Generar script
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Workspace */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden flex-1 flex flex-col">
                <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-1">
                    {[
                      { id: "edit", label: "Markdown", icon: Code },
                      { id: "preview", label: "Vista previa", icon: Eye },
                      { id: "code", label: LANGUAGES.find((l) => l.id === selectedLanguage)?.name || "Script", icon: Terminal },
                    ].map((m) => (
                      <button key={m.id} onClick={() => setViewMode(m.id as any)}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                          viewMode === m.id ? "bg-white shadow-sm text-cyan-600 ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600")}>
                        <m.icon className="w-3.5 h-3.5" /> {m.label}
                      </button>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={copyToClipboard} disabled={viewMode === "code" ? !generatedCode : !markdown}
                    className="h-8 px-3 rounded-lg text-slate-500 hover:text-cyan-600 font-bold text-[10px] uppercase">
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                  </Button>
                </CardHeader>
                <CardContent className="p-0 flex-1 relative">
                  {viewMode === "edit" ? (
                    <Textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} placeholder="El contenido convertido aparecerá aquí…"
                      className="w-full border-none focus-visible:ring-0 rounded-none p-6 font-mono text-xs leading-relaxed resize-none min-h-[420px]" />
                  ) : viewMode === "code" ? (
                    <Textarea value={generatedCode} onChange={(e) => setGeneratedCode(e.target.value)}
                      placeholder={`Pulsa "Generar script" para crear el código en ${LANGUAGES.find((l) => l.id === selectedLanguage)?.name}…`}
                      className="w-full border-none focus-visible:ring-0 rounded-none p-6 font-mono text-[11px] leading-relaxed resize-none min-h-[420px] bg-slate-900 text-emerald-400" />
                  ) : (
                    <div className="p-6 markdown-body prose prose-slate max-w-none prose-sm min-h-[420px] overflow-y-auto">
                      {markdown ? <ReactMarkdown>{markdown}</ReactMarkdown> : (
                        <div className="flex flex-col items-center justify-center h-[360px] text-slate-300 gap-4">
                          <FileText className="w-14 h-14 opacity-30" />
                          <p className="text-xs font-bold text-slate-400">Sube un documento para empezar</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Barra de acciones */}
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={downloadMarkdown} disabled={!markdown} variant="outline" className="rounded-xl text-[10px] font-bold uppercase h-10">
                  <Download className="w-3.5 h-3.5 mr-2" /> Descargar .md
                </Button>
                <Button onClick={downloadCode} disabled={!markdown || isTransforming} variant="outline" className="rounded-xl text-[10px] font-bold uppercase h-10">
                  <Download className="w-3.5 h-3.5 mr-2" /> Descargar .{LANGUAGES.find((l) => l.id === selectedLanguage)?.ext}
                </Button>
                <Button onClick={() => setShowSaveForm(!showSaveForm)} disabled={!markdown} className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-[10px] font-bold uppercase h-10">
                  <Save className="w-3.5 h-3.5 mr-2" /> Guardar en biblioteca
                </Button>
                <Button onClick={clearWorkspace} disabled={!markdown && !file} variant="ghost" className="rounded-xl text-slate-400 hover:text-rose-600 text-[10px] font-bold uppercase h-10">
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Limpiar
                </Button>
              </div>

              {showSaveForm && (
                <Card className="rounded-xl border-cyan-200 bg-cyan-50/40 p-4">
                  <div className="flex items-center gap-2">
                    <Input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)}
                      placeholder={file ? file.name.split(".")[0] : "Nombre de la conversión"} className="rounded-lg bg-white" />
                    <Button onClick={saveToLibrary} className="rounded-lg bg-cyan-600 hover:bg-cyan-700 text-[10px] font-bold uppercase h-10 px-4">Guardar</Button>
                    <Button variant="ghost" onClick={() => setShowSaveForm(false)} className="h-10 px-2"><X className="w-4 h-4" /></Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════ BIBLIOTECA ══════════ */}
      {tab === "biblioteca" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input placeholder="Buscar conversión..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="rounded-xl pl-9" />
            </div>
            <button onClick={() => setOnlyFavs(!onlyFavs)} className={cn("flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border-2 transition-all", onlyFavs ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-500 hover:border-amber-200")}>
              <Star className={cn("w-4 h-4", onlyFavs && "fill-amber-400 text-amber-400")} /> Favoritos
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
              <BookMarked className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">{markdowns.length === 0 ? "Biblioteca vacía" : "Sin resultados"}</p>
              <p className="text-sm text-slate-400 mt-1">{markdowns.length === 0 ? "Convierte un documento y guárdalo para tenerlo siempre a mano." : "Prueba a cambiar los filtros."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((m) => (
                <Card key={m.id} className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden hover:shadow-md transition-all">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b bg-cyan-50 text-cyan-700">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">{m.category}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => toggleFav(m.id)} className="p-1.5 rounded-lg hover:bg-white/60" title="Favorito">
                        <Star className={cn("w-3.5 h-3.5", m.isFavorite ? "fill-amber-400 text-amber-400" : "text-current opacity-50")} />
                      </button>
                      <button onClick={() => copyEntry(m.content, m.id)} className="p-1.5 rounded-lg hover:bg-white/60" title="Copiar">
                        {copiedId === m.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => { setEditingId(editingId === m.id ? null : m.id); setEditContent(m.content); }} className="p-1.5 rounded-lg hover:bg-white/60" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => downloadEntry(m)} className="p-1.5 rounded-lg hover:bg-white/60" title="Descargar .md">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => loadIntoConverter(m)} className="p-1.5 rounded-lg hover:bg-white/60" title="Abrir en conversor">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteEntry(m.id)} className="p-1.5 rounded-lg hover:bg-white/60 text-rose-500" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-bold text-slate-900 text-sm">{m.title}</h4>
                    {editingId === m.id ? (
                      <div className="space-y-2">
                        <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="rounded-lg min-h-[140px] font-mono text-xs" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(m.id)} className="rounded-lg text-[10px] font-bold uppercase bg-cyan-600 hover:bg-cyan-700"><Save className="w-3 h-3 mr-1" /> Guardar</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="rounded-lg text-[10px] font-bold uppercase">Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-[11px] font-mono text-slate-600 bg-slate-50 rounded-lg border border-slate-100 p-3 max-h-36 overflow-auto">{m.content}</pre>
                    )}
                    <p className="text-[9px] text-slate-400">{new Date(m.createdAt).toLocaleString("es-ES")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
