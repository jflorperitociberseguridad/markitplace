import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Coins, Files, PiggyBank, TrendingUp, TrendingDown, Activity, Zap, Terminal,
  CheckCircle2, AlertTriangle, Clock, Server, Copy, Check, FlaskConical,
  FileText, Bot, QrCode, Flame, Star, Bell, RefreshCcw, ChevronRight,
  Wrench, Braces,
} from "lucide-react";
import { DB } from "../types";
import { getAIConfig } from "../aiConfig";
import axios from "axios";
import { toast } from "sonner";

interface DashboardProps {
  db: DB;
  onNavigate?: (tab: string) => void;
}

// Precios €/millón tokens
const PRICES: Record<string, { in: number; out: number }> = {
  "gemini-2.0-flash": { in: 0.10, out: 0.40 },
  "gemini-2.5-flash": { in: 0.15, out: 0.60 },
  "gemini-2.5-pro":   { in: 1.25, out: 10.0 },
  "gpt-4o":           { in: 2.50, out: 10.0 },
  "gpt-4o-mini":      { in: 0.15, out: 0.60 },
  "gpt-4.1":          { in: 2.00, out: 8.0  },
};

function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function pctDiff(a: number, b: number): number {
  if (b === 0) return a > 0 ? 100 : 0;
  return Math.round(((a - b) / b) * 100);
}

// ── Consejos de prompting rotativos (didácticos, para el alumnado) ──
const PROMPT_TIPS = [
  "Estructura tus prompts con C.R.E.F.O.: Contexto, Rol, Específicos, Formato, Objetivo.",
  "Asigna un rol a la IA: \"Actúa como consultor de marketing\" mejora mucho la respuesta.",
  "Define siempre la audiencia: no es lo mismo explicar a un experto que a un principiante.",
  "Indica el formato de salida que quieres: tabla, lista, JSON, pasos numerados…",
  "Da contexto antes de pedir: cuanto mejor describas tu situación, mejor será el resultado.",
  "Usa few-shot: incluye 2 o 3 ejemplos para enseñar a la IA el patrón que esperas.",
  "Para tareas complejas, pide \"razona paso a paso\" (chain-of-thought) antes de la respuesta.",
  "Pon restricciones claras: longitud máxima, tono, qué evitar. Acotar mejora la precisión.",
  "Genera dos versiones y compáralas: a menudo la segunda idea es mejor que la primera.",
  "Revisa y refina: pídele a la IA que mejore su propia respuesta señalando qué pulir.",
  "Usa delimitadores (### o comillas triples) para separar instrucciones del contenido.",
  "Sé específico con el objetivo: \"aumentar ventas un 20% en 6 meses\" guía mejor que \"vender más\".",
];

// ── Sesión tokens (en memoria, se resetea al recargar) ──
let _sessionTokens = 0;
export function addSessionTokens(n: number) { _sessionTokens += n; }

export function Dashboard({ db, onNavigate }: DashboardProps) {
  const [sysStatus, setSysStatus] = React.useState<any>(null);
  const [serverConfig, setServerConfig] = React.useState<any>(null);
  const [logData, setLogData] = React.useState<any[]>([]);
  const [autosaveData, setAutosaveData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [publicStats, setPublicStats] = React.useState<any>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [sessionTokens] = React.useState(() => _sessionTokens);
  const [streak, setStreak] = React.useState(0);
  const [showQR, setShowQR] = React.useState(false);
  const [kioskMode, setKioskMode] = React.useState(false);
  const [alerts, setAlerts] = React.useState<string[]>([]);
  const [tipIndex, setTipIndex] = React.useState(() => Math.floor(Math.random() * PROMPT_TIPS.length));

  const aiCfg = getAIConfig();
  const price = PRICES[aiCfg.model] || { in: 1.0, out: 4.0 };
  const totalTokens = publicStats?.tokens ?? db.stats.totalTokens;
  const estimatedCost = (totalTokens / 1_000_000) * (price.in + price.out);

  const fetchData = React.useCallback(async () => {
    try {
      const [cfgRes, statsRes] = await Promise.allSettled([
        axios.get("/api/server-config"),
        axios.get("/api/public-stats"),
      ]);
      if (cfgRes.status === "fulfilled") setServerConfig((cfgRes.value as any).data);
      if (statsRes.status === "fulfilled") {
        const stats = (statsRes.value as any).data;
        setLogData(stats.recentLog || []);
        setAutosaveData(stats.recentAutosave || []);
        setPublicStats(stats);
      }

      // System status sin auth (solo datos básicos del endpoint público)
      try {
        const sysRes = await axios.get("/api/system-status");
        setSysStatus(sysRes.data);
      } catch { /* sin auth, no pasa nada */ }
    } catch { /* silencioso */ } finally { setLoading(false); }
  }, []);

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Rotación automática del consejo de prompting cada 6 segundos
  React.useEffect(() => {
    const t = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % PROMPT_TIPS.length);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  // Calcular racha de uso
  React.useEffect(() => {
    if (logData.length === 0) return;
    const days = new Set(logData.map((e: any) => new Date(e.timestamp).toLocaleDateString("es-ES")));
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (days.has(d.toLocaleDateString("es-ES"))) count++;
      else if (i > 0) break;
    }
    setStreak(count);
  }, [logData]);

  // Alertas automáticas
  React.useEffect(() => {
    const newAlerts: string[] = [];
    if (sysStatus?.sistema?.ram?.pct > 85) newAlerts.push("RAM al " + sysStatus.sistema.ram.pct + "%");
    if (sysStatus?.almacenamiento?.disco?.total) {
      const diskPct = Math.round(sysStatus.almacenamiento.disco.used / sysStatus.almacenamiento.disco.total * 100);
      if (diskPct > 80) newAlerts.push("Disco al " + diskPct + "%");
    }
    if (sysStatus?.seguridad?.authFailures > 10) newAlerts.push(sysStatus.seguridad.authFailures + " intentos de login fallidos");
    setAlerts(newAlerts);
  }, [sysStatus]);

  // Gráfica 7 días real
  const chartData = React.useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("es-ES", { weekday: "short" });
      days[key] = 0;
    }
    logData.forEach((e: any) => {
      const ts = new Date(e.timestamp);
      const daysAgo = Math.floor((Date.now() - ts.getTime()) / 86400000);
      if (daysAgo < 7) {
        const key = ts.toLocaleDateString("es-ES", { weekday: "short" });
        if (key in days) days[key]++;
      }
    });
    return Object.entries(days).map(([name, prompts]) => ({ name, prompts }));
  }, [logData]);

  // Comparativa semana anterior
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const twoWeeksAgo = now - 14 * 86400000;
  const thisWeekLogs = logData.filter((e: any) => new Date(e.timestamp).getTime() > weekAgo);
  const lastWeekLogs = logData.filter((e: any) => {
    const t = new Date(e.timestamp).getTime();
    return t > twoWeeksAgo && t <= weekAgo;
  });
  const promptsDiff = pctDiff(thisWeekLogs.length, lastWeekLogs.length);

  // Registro de actividad real
  const recentActivity = React.useMemo(() => {
    const acts: Array<{ type: string; msg: string; ts: number; icon: any; color: string }> = [];
    logData.slice(0, 8).forEach((e: any) => {
      const ep = e.endpoint || "";
      const type = ep.includes("convert") ? "CONVERSION" : ep.includes("automation") ? "AUTOMATIZACIÓN" : ep.includes("transform") ? "TRANSFORM" : "GENERACIÓN";
      const color = type === "CONVERSION" ? "text-amber-500" : type === "AUTOMATIZACIÓN" ? "text-emerald-500" : type === "TRANSFORM" ? "text-violet-500" : "text-indigo-500";
      const icon = type === "CONVERSION" ? Files : type === "AUTOMATIZACIÓN" ? Bot : type === "TRANSFORM" ? Terminal : Zap;
      acts.push({ type, msg: e.prompt?.slice(0, 60) || "Acción registrada", ts: new Date(e.timestamp).getTime(), icon, color });
    });
    return acts.sort((a, b) => b.ts - a.ts).slice(0, 6);
  }, [logData]);

  // Últimos 3 prompts
  const lastPrompts = autosaveData.slice(0, 3);

  // Prompt destacado (favorito o último)
  const featuredPrompt = db.prompts.find(p => p.isFavorite) || db.prompts[0];

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copiado");
  };

  const version = "2.4.0"; // sincronizar con package.json si se quiere


  // Mapa de calor 24h × 7 días desde publicStats.recentLog (limitado) o logData
  const heatmapData = React.useMemo(() => {
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    logData.forEach((e: any) => {
      const d = new Date(e.timestamp);
      const dayOfWeek = d.getDay(); // 0=Dom, 6=Sab
      const hour = d.getHours();
      const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000);
      if (daysAgo < 7) grid[dayOfWeek][hour]++;
    });
    return grid;
  }, [logData]);
  const heatmapMax = Math.max(1, ...heatmapData.flat());
  const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  if (kioskMode) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest">Cibermedida · Modo Presentación</div>
          <h1 className="text-5xl font-extrabold text-white">PromptCore</h1>
          <p className="text-slate-400">Laboratorio de Ingeniería de Prompts con IA</p>
          <div className="flex items-center justify-center gap-6 mt-8">
            <div className="text-center">
              <p className="text-4xl font-extrabold text-indigo-400">{totalTokens.toLocaleString("es-ES")}</p>
              <p className="text-slate-500 text-sm">Tokens procesados</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-extrabold text-emerald-400">{db.prompts.length}</p>
              <p className="text-slate-500 text-sm">Prompts en biblioteca</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-extrabold text-amber-400">{db.stats.filesProcessed}</p>
              <p className="text-slate-500 text-sm">Archivos procesados</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setKioskMode(false)} className="absolute bottom-8 right-8 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] uppercase font-bold">
          Salir del modo presentación
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div key={tipIndex} className="inline-flex items-start gap-2 mb-3 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-50 to-cyan-50 border border-indigo-100 max-w-xl animate-in fade-in slide-in-from-left-2 duration-500">
            <span className="text-base leading-none mt-0.5">💡</span>
            <div>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Consejo de prompting</span>
              <p className="text-xs font-medium text-slate-600 mt-0.5">{PROMPT_TIPS[tipIndex]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            Cibermedida / <span className="text-indigo-600">PromptCore v{version}</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Panel de Control</h2>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            {sysStatus && <span className="ml-2 text-slate-400">· Servidor activo {fmtUptime(sysStatus.sistema?.uptime?.server || 0)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700">
              <Bell className="w-4 h-4" /> {alerts.length} alerta{alerts.length > 1 ? "s" : ""}
            </div>
          )}
          {serverConfig && (
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${serverConfig.openai ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
                <div className={`w-2 h-2 rounded-full ${serverConfig.openai ? "bg-emerald-500" : "bg-rose-500"}`} />
                OpenAI
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${serverConfig.gemini ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
                <div className={`w-2 h-2 rounded-full ${serverConfig.gemini ? "bg-emerald-500" : "bg-rose-500"}`} />
                Gemini
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${serverConfig.claude ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
                <div className={`w-2 h-2 rounded-full ${serverConfig.claude ? "bg-amber-500" : "bg-rose-500"}`} />
                Claude
              </div>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowQR(!showQR)} className="rounded-xl text-[10px] font-bold uppercase h-9">
            <QrCode className="w-4 h-4 mr-1" /> QR
          </Button>
          <Button variant="outline" size="sm" onClick={() => setKioskMode(true)} className="rounded-xl text-[10px] font-bold uppercase h-9">
            <Activity className="w-4 h-4 mr-1" /> Presentación
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="rounded-xl text-[10px] font-bold uppercase h-9">
            <RefreshCcw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refrescar
          </Button>
        </div>
      </header>

      {/* QR */}
      {showQR && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-6">
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.origin)}`} alt="QR" className="rounded-lg border border-slate-200" />
          <div>
            <p className="font-bold text-slate-900">Acceso rápido para alumnos</p>
            <p className="text-sm text-slate-500 mt-1">{window.location.origin}</p>
            <p className="text-xs text-slate-400 mt-2">Escanea con el móvil para abrir la app en clase</p>
          </div>
        </div>
      )}

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {a}
            </div>
          ))}
        </div>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Tokens Generados", icon: Coins, color: "text-indigo-600", bg: "bg-indigo-50",
            value: totalTokens.toLocaleString("es-ES"),
            diff: promptsDiff, diffLabel: "vs semana anterior",
          },
          {
            label: "Coste Estimado", icon: PiggyBank, color: "text-emerald-600", bg: "bg-emerald-50",
            value: `${estimatedCost < 0.01 ? estimatedCost.toFixed(4) : estimatedCost.toFixed(2)} €`,
            sub: `${aiCfg.provider} / ${aiCfg.model}`,
          },
          {
            label: "Archivos Procesados", icon: Files, color: "text-amber-600", bg: "bg-amber-50",
            value: db.stats.filesProcessed,
            sub: "conversiones totales",
          },
          {
            label: "Salud del Sistema", icon: Activity, color: "text-rose-600", bg: "bg-rose-50",
            value: sysStatus ? `${100 - (sysStatus.sistema?.ram?.pct || 0)}%` : "—",
            sub: sysStatus ? `RAM ${sysStatus.sistema?.ram?.pct}% · CPU ${sysStatus.sistema?.cpu?.usage?.toFixed(1)}%` : "Cargando...",
          },
        ].map((stat, i) => (
          <Card key={i} className="rounded-xl border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{stat.label}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}><stat.icon className={`h-4 w-4 ${stat.color}`} /></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-slate-900">{stat.value}</div>
              {stat.diff !== undefined ? (
                <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${stat.diff >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                  {stat.diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {stat.diff >= 0 ? "+" : ""}{stat.diff}% {stat.diffLabel}
                </div>
              ) : stat.sub ? (
                <p className="text-[10px] text-slate-400 mt-1.5">{stat.sub}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fila: gráfica + actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gráfica 7 días */}
        <Card className="lg:col-span-2 rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" /> Actividad — últimos 7 días
            </CardTitle>
            <p className="text-xs text-slate-400">Prompts generados por día (datos reales)</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPrompts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="prompts" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPrompts)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {chartData.every(d => d.prompts === 0) && (
              <p className="text-xs text-center text-slate-400 -mt-4">Sin actividad esta semana. ¡Genera tu primer prompt!</p>
            )}
          </CardContent>
        </Card>

        {/* Registro de actividad real */}
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              Actividad Reciente
              <button onClick={() => onNavigate?.("promptlog")} className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1">
                VER TODO <ChevronRight className="w-3 h-3" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Sin actividad registrada aún</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentActivity.map((log, i) => (
                  <div key={i} className="p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <log.icon className={`w-3 h-3 ${log.color}`} />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{log.type}</span>
                      </div>
                      <span className="text-[9px] text-slate-400">{timeAgo(log.ts)}</span>
                    </div>
                    <p className="text-xs text-slate-700 truncate">{log.msg}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fila: accesos rápidos + racha + sesión */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Accesos directos */}
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Accesos Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {[
              { label: "Lab de Prompts", icon: FlaskConical, tab: "prompts", color: "bg-indigo-600 hover:bg-indigo-700" },
              { label: "MarkDown Pro", icon: FileText, tab: "markdown", color: "bg-amber-500 hover:bg-amber-600" },
              { label: "Automatizaciones", icon: Bot, tab: "automation", color: "bg-emerald-600 hover:bg-emerald-700" },
              { label: "Constructor de Skills", icon: Wrench, tab: "skills", color: "bg-purple-600 hover:bg-purple-700" },
              { label: "JSON Builder", icon: Braces, tab: "json", color: "bg-orange-500 hover:bg-orange-600" },
            ].map(({ label, icon: Icon, tab, color }) => (
              <button key={tab} onClick={() => onNavigate?.(tab)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white text-xs font-bold uppercase tracking-widest transition-all ${color}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Racha de uso */}
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Racha de Uso</CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Flame className={`w-8 h-8 ${streak > 0 ? "text-orange-500" : "text-slate-300"}`} />
              <span className="text-5xl font-extrabold text-slate-900">{streak}</span>
            </div>
            <p className="text-xs text-slate-500">días consecutivos usando la app</p>
            {streak >= 7 && <Badge className="bg-orange-100 text-orange-700 text-[9px]">🔥 ¡Semana completa!</Badge>}
            {streak === 0 && <p className="text-[10px] text-slate-400">Genera un prompt hoy para empezar tu racha</p>}
          </CardContent>
        </Card>

        {/* Contador de sesión */}
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Esta Sesión</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Tokens usados</span>
              <span className="text-sm font-bold text-indigo-600">{sessionTokens.toLocaleString("es-ES")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Coste sesión</span>
              <span className="text-sm font-bold text-emerald-600">
                ~{((sessionTokens / 1_000_000) * (price.in + price.out)).toFixed(5)} €
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Modelo activo</span>
              <Badge variant="outline" className="text-[9px]">{aiCfg.model}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Prompts totales lib.</span>
              <span className="text-sm font-bold text-slate-700">{db.prompts.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Últimos 3 prompts + prompt destacado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Últimos prompts generados */}
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              Últimos Prompts Generados
              <button onClick={() => onNavigate?.("prompts")} className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1">
                IR AL LAB <ChevronRight className="w-3 h-3" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lastPrompts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Sin prompts autoguardados aún</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {lastPrompts.map((p: any, i: number) => (
                  <div key={p.id} className="p-4 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{p.topic || `Prompt ${i + 1}`}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{p.fecha} · {p.hora} · {p.provider}/{p.model}</p>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{p.prompt}</p>
                      </div>
                      <button onClick={() => copyText(p.prompt, p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-200">
                        {copiedId === p.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prompt destacado */}
        <Card className="rounded-xl border-indigo-200 shadow-sm bg-gradient-to-br from-indigo-50 to-purple-50 overflow-hidden">
          <CardHeader className="border-b border-indigo-100 bg-white/60 pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" /> Prompt Destacado
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {featuredPrompt ? (
              <>
                <div>
                  <p className="text-xs font-bold text-slate-700">{featuredPrompt.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[9px]">{featuredPrompt.category}</Badge>
                    {featuredPrompt.tags.slice(0, 2).map(t => (
                      <span key={t} className="text-[9px] bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-[11px] font-mono text-slate-700 bg-white/80 rounded-lg border border-indigo-100 p-3 max-h-32 overflow-auto">
                  {featuredPrompt.content}
                </pre>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => copyText(featuredPrompt.content, "featured")}
                    className="rounded-lg text-[10px] font-bold uppercase bg-indigo-600 hover:bg-indigo-700 flex-1 h-8">
                    {copiedId === "featured" ? <><Check className="w-3 h-3 mr-1" /> Copiado</> : <><Copy className="w-3 h-3 mr-1" /> Copiar</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onNavigate?.("prompts")}
                    className="rounded-lg text-[10px] font-bold uppercase h-8">
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 space-y-2">
                <Star className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-400">Guarda un prompt en la Biblioteca<br />y márcalo como favorito para verlo aquí</p>
                <Button size="sm" onClick={() => onNavigate?.("prompts")} className="rounded-lg text-[10px] font-bold uppercase bg-indigo-600 hover:bg-indigo-700 h-8">
                  Ir al Lab
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      {/* ── Analítica avanzada ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Mapa de calor por hora */}
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-500" /> Mapa de Calor — Uso por hora
            </CardTitle>
            <p className="text-xs text-slate-400">Últimos 7 días · hora local</p>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-1">
              {/* Labels horas */}
              <div className="flex flex-col gap-0.5 mr-1">
                <div className="h-3 w-6" />
                {DAYS_ES.map(d => <div key={d} className="h-3 text-[8px] text-slate-400 flex items-center">{d}</div>)}
              </div>
              {/* Grid */}
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-0.5 mb-0.5">
                  {Array.from({length: 24}, (_, h) => (
                    <div key={h} className="flex-1 text-[7px] text-slate-300 text-center">{h % 6 === 0 ? h + "h" : ""}</div>
                  ))}
                </div>
                {heatmapData.map((row, day) => (
                  <div key={day} className="flex gap-0.5 mb-0.5">
                    {row.map((val, hour) => {
                      const intensity = val / heatmapMax;
                      const alpha = intensity === 0 ? 0.05 : 0.15 + intensity * 0.85;
                      return (
                        <div
                          key={hour}
                          title={`${DAYS_ES[day]} ${hour}:00 — ${val} prompts`}
                          className="flex-1 h-3 rounded-sm cursor-default transition-all hover:scale-110"
                          style={{ backgroundColor: `rgba(99, 102, 241, ${alpha})` }}
                        />
                      );
                    })}
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[9px] text-slate-400">Menos</span>
                  {[0.05, 0.25, 0.5, 0.75, 1].map(a => (
                    <div key={a} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(99,102,241,${a})` }} />
                  ))}
                  <span className="text-[9px] text-slate-400">Más</span>
                </div>
              </div>
            </div>
            {logData.length === 0 && <p className="text-xs text-center text-slate-400 mt-2">Sin datos de actividad aún</p>}
          </CardContent>
        </Card>

        {/* Prompts más usados */}
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Top Prompts de la Biblioteca
            </CardTitle>
            <p className="text-xs text-slate-400">Por categoría · {db.prompts.length} total</p>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {db.prompts.length === 0 ? (
              <p className="text-xs text-center text-slate-400 py-4">Sin prompts guardados aún</p>
            ) : (
              <>
                {/* Por categoría */}
                {(() => {
                  const cats: Record<string, number> = {};
                  db.prompts.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
                  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
                  const max = sorted[0]?.[1] || 1;
                  const catColors: Record<string, string> = { Docencia: "bg-blue-500", Ventas: "bg-emerald-500", Automatización: "bg-purple-500", Engineering: "bg-amber-500" };
                  return sorted.slice(0, 5).map(([cat, count]) => (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700">{cat}</span>
                        <span className="text-slate-400">{count} prompt{count > 1 ? "s" : ""}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${catColors[cat] || "bg-indigo-500"}`} style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  ));
                })()}
                {/* Favoritos */}
                {db.prompts.filter(p => p.isFavorite).length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-amber-600 uppercase mb-2">⭐ Favoritos</p>
                    {db.prompts.filter(p => p.isFavorite).slice(0, 3).map(p => (
                      <div key={p.id} className="flex items-center justify-between py-1">
                        <span className="text-xs text-slate-700 truncate flex-1">{p.title}</span>
                        <Badge variant="outline" className="text-[9px] ml-2 flex-shrink-0">{p.category}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Changelog */}
      <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" /> Changelog · Últimas actualizaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-50">
            {[
              { v: "2.4.0", fecha: "Jun 2026", desc: "Dashboard con datos reales, modo presentación, QR de acceso, racha de uso" },
              { v: "2.3.0", fecha: "Jun 2026", desc: "Panel de estado del servidor con métricas en tiempo real" },
              { v: "2.2.0", fecha: "Jun 2026", desc: "Lab de Prompts rediseñado con P.I.C.A.R.D., evaluador, A/B, modo aprendizaje" },
              { v: "2.1.0", fecha: "Jun 2026", desc: "Autoguardado de prompts, registro de auditoría con IP y hora" },
              { v: "2.0.0", fecha: "Jun 2026", desc: "Auth backend, API keys en servidor, rate limiting, backups automáticos" },
            ].map((item) => (
              <div key={item.v} className="flex items-start gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                <Badge className="bg-indigo-100 text-indigo-700 text-[9px] flex-shrink-0 mt-0.5">v{item.v}</Badge>
                <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5 w-16">{item.fecha}</span>
                <p className="text-xs text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
