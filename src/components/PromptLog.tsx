import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { History, Download, RefreshCcw, Trash2, Lock, Search, ChevronDown, ChevronUp, BookMarked } from "lucide-react";
import { PromptLogEntry, AutosaveEntry } from "../types";
import { isUnlocked, login } from "../auth";
import { toast } from "sonner";
import axios from "axios";

export function PromptLog() {
  const [unlocked, setUnlocked] = React.useState(isUnlocked());
  const [password, setPassword] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"log" | "autosave">("autosave");
  const [entries, setEntries] = React.useState<PromptLogEntry[]>([]);
  const [autosaves, setAutosaves] = React.useState<AutosaveEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [ipFilter, setIpFilter] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const fetchLog = React.useCallback(async () => {
    setLoading(true);
    try {
      const [logRes, autosaveRes] = await Promise.all([
        axios.get("/api/prompt-log"),
        axios.get("/api/autosave"),
      ]);
      setEntries(logRes.data);
      setAutosaves(autosaveRes.data);
    } catch {
      toast.error("No se pudo cargar el registro. ¿Sesión caducada?");
      setUnlocked(false);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (unlocked) fetchLog();
  }, [unlocked, fetchLog]);

  const handleUnlock = async () => {
    try {
      if (await login(password)) {
        setUnlocked(true);
        setPassword("");
        toast.success("Acceso concedido al registro");
      }
    } catch (e: any) {
      toast.error("Acceso denegado", { description: e.response?.data?.error || "Contraseña incorrecta" });
    }
  };

  const clearLog = async () => {
    const isAutosave = activeTab === "autosave";
    if (!window.confirm(`¿Borrar todo el ${isAutosave ? "autoguardado" : "registro"}? Esta acción no se puede deshacer.`)) return;
    try {
      if (isAutosave) {
        await axios.delete("/api/autosave");
        setAutosaves([]);
      } else {
        await axios.delete("/api/prompt-log");
        setEntries([]);
      }
      toast.success("Borrado completado");
    } catch {
      toast.error("Error al borrar");
    }
  };

  const filtered = entries.filter((e) => {
    if (search && !e.prompt.toLowerCase().includes(search.toLowerCase())) return false;
    if (ipFilter && !e.ip.includes(ipFilter)) return false;
    if (dateFilter && !e.fecha.includes(dateFilter)) return false;
    return true;
  });

  const exportCSV = () => {
    const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Fecha", "Hora", "IP", "Pais", "Origen", "Proveedor", "Modelo", "Navegador", "Version", "SO", "Idioma", "ZonaHoraria", "Resolucion", "Dispositivo", "Sesion", "Prompt"].join(";"),
      ...filtered.map((e) =>
        [e.fecha, e.hora, e.ip, e.country, e.endpoint, e.provider, e.model, e.browser, e.browserVersion, e.os, e.language, e.timezone, e.screenResolution, e.deviceType, e.sessionId, esc(e.prompt)].join(";")
      ),
    ];
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `registro-actividad-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("CSV exportado");
  };

  const filteredAutosaves = autosaves.filter((e) => {
    if (search && !e.prompt.toLowerCase().includes(search.toLowerCase()) && !e.topic.toLowerCase().includes(search.toLowerCase())) return false;
    if (ipFilter && !e.ip.includes(ipFilter)) return false;
    if (dateFilter && !e.fecha.includes(dateFilter)) return false;
    return true;
  });

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-in fade-in zoom-in duration-500">
        <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-2xl p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Registro de Actividad</h2>
            <p className="text-sm text-slate-500 mt-1">Zona de auditoría. Introduce la contraseña de administrador.</p>
          </div>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Contraseña del Sistema"
              className="rounded-xl border-slate-200 text-center h-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            />
            <Button onClick={handleUnlock} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-widest text-xs h-12">
              Desbloquear Registro
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            Auditoría / <span className="text-indigo-600">Registro de Actividad</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Registro de Actividad</h2>
          <p className="text-sm text-slate-500">
            Cada acción ejecutada queda registrada con fecha, hora, IP y datos técnicos de navegación. Las IP y los identificadores técnicos son datos personales (RGPD): informa a tus usuarios.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={fetchLog} disabled={loading} className="rounded-xl text-[10px] font-bold uppercase tracking-widest h-10">
            <RefreshCcw className={"w-4 h-4 mr-2 " + (loading ? "animate-spin" : "")} /> Actualizar
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={(activeTab === "autosave" ? filteredAutosaves : filtered).length === 0} className="rounded-xl text-[10px] font-bold uppercase tracking-widest h-10">
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
          <Button variant="outline" onClick={clearLog} className="rounded-xl text-[10px] font-bold uppercase tracking-widest h-10 text-rose-600 border-rose-200 hover:bg-rose-50">
            <Trash2 className="w-4 h-4 mr-2" /> Vaciar
          </Button>
        </div>
      </header>

      {/* Pestañas */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "autosave" ? "default" : "outline"}
          onClick={() => setActiveTab("autosave")}
          className={"rounded-xl text-[10px] font-bold uppercase tracking-widest h-10 " + (activeTab === "autosave" ? "bg-indigo-600 hover:bg-indigo-700" : "")}
        >
          <BookMarked className="w-4 h-4 mr-2" /> Autoguardado ({autosaves.length})
        </Button>
        <Button
          variant={activeTab === "log" ? "default" : "outline"}
          onClick={() => setActiveTab("log")}
          className={"rounded-xl text-[10px] font-bold uppercase tracking-widest h-10 " + (activeTab === "log" ? "bg-indigo-600 hover:bg-indigo-700" : "")}
        >
          <History className="w-4 h-4 mr-2" /> Registro de actividad ({entries.length})
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input placeholder="Buscar en el texto del prompt..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl pl-9" />
        </div>
        <Input placeholder="Filtrar por IP (ej. 83.45...)" value={ipFilter} onChange={(e) => setIpFilter(e.target.value)} className="rounded-xl" />
        <Input placeholder="Filtrar por fecha (ej. 11/6/2026)" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="rounded-xl" />
      </div>

      {/* ── Tabla Autoguardado ── */}
      {activeTab === "autosave" && (
        <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Hora</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">Modelo</th>
                    <th className="px-4 py-3">Tema</th>
                    <th className="px-4 py-3">Prompt</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAutosaves.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                        {loading ? "Cargando..." : "Sin prompts autoguardados aún. Genera uno en el Lab de Prompts."}
                      </td>
                    </tr>
                  )}
                  {filteredAutosaves.map((e) => (
                    <React.Fragment key={e.id}>
                      <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{e.fecha}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600">{e.hora}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-indigo-600">{e.ip}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{e.provider}/{e.model}</td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-slate-600 text-xs">{e.topic}</td>
                        <td className="px-4 py-3 max-w-[300px] truncate text-slate-700">{e.prompt}</td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                            {expanded === e.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </td>
                      </tr>
                      {expanded === e.id && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={7} className="px-6 py-4 space-y-3">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Tema</p>
                              <p className="text-xs text-slate-600">{e.topic}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Prompt generado</p>
                              <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono bg-white border border-slate-200 rounded-lg p-4 max-h-64 overflow-auto">{e.prompt}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      {activeTab === "autosave" && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <BookMarked className="w-4 h-4" /> {filteredAutosaves.length} de {autosaves.length} prompts autoguardados · máximo 500 conservados
        </p>
      )}

      {/* ── Tabla Registro ── */}
      {activeTab === "log" && (
      <>
      <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Modelo</th>
                  <th className="px-4 py-3">Prompt</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      {loading ? "Cargando..." : "Sin registros que coincidan con los filtros."}
                    </td>
                  </tr>
                )}
                {filtered.map((e) => (
                  <React.Fragment key={e.id}>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{e.fecha}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600">{e.hora}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-indigo-600">{e.ip}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><Badge variant="outline" className="text-[9px]">{e.endpoint}</Badge></td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{e.provider}/{e.model}</td>
                      <td className="px-4 py-3 max-w-[300px] truncate text-slate-700">{e.prompt}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                          {expanded === e.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </td>
                    </tr>
                    {expanded === e.id && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={7} className="px-6 py-4 space-y-3">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Datos técnicos de navegación</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 bg-white border border-slate-200 rounded-lg p-4">
                              {[
                                ["IP pública", e.ip],
                                ["País aproximado", e.country],
                                ["Fecha y hora", `${e.fecha} ${e.hora}`],
                                ["Zona horaria", e.timezone],
                                ["Navegador", e.browser],
                                ["Versión navegador", e.browserVersion],
                                ["Sistema operativo", e.os],
                                ["Idioma", e.language],
                                ["Resolución", e.screenResolution],
                                ["Tipo dispositivo", e.deviceType],
                                ["ID de sesión", e.sessionId],
                                ["Origen / acción", e.endpoint],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">{label}</p>
                                  <p className="text-xs text-slate-700 font-mono break-all">{value || "—"}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          {e.userAgent && (
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">User-Agent completo</p>
                              <p className="text-[11px] text-slate-500 font-mono break-all bg-white border border-slate-200 rounded-lg p-2">{e.userAgent}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Contenido del prompt</p>
                            <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono bg-white border border-slate-200 rounded-lg p-4 max-h-64 overflow-auto">{e.prompt}</pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400 flex items-center gap-2">
        <History className="w-4 h-4" /> {filtered.length} de {entries.length} registros · máximo 5000 conservados en servidor
      </p>
      </>
      )}
    </div>
  );
}
