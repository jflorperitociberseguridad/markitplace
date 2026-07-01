import React from "react";
import {
  Cpu, HardDrive, Activity, Shield, Zap, TrendingUp, Globe, Server,
  RefreshCcw, Coins, Clock, Users, Database, AlertTriangle, CheckCircle2,
  BarChart3, Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isUnlocked, login } from "../auth";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import axios from "axios";

function fmt(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + " MB";
  return (b / 1024 / 1024 / 1024).toFixed(2) + " GB";
}
function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtCost(n: number): string { return n < 0.01 ? n.toFixed(5) : n.toFixed(3); }

function Bar({ pct, color }: { pct: number; color: string }) {
  const c = pct > 85 ? "bg-rose-500" : pct > 60 ? "bg-amber-400" : color;
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${c}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "text-slate-700", badge, badgeColor }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:shadow-sm transition-shadow">
      <div className={`p-2 rounded-lg bg-slate-50 ${color}`}><Icon className="w-4 h-4" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {badge && <Badge className={`text-[9px] flex-shrink-0 ${badgeColor || "bg-emerald-100 text-emerald-700"}`}>{badge}</Badge>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color }: { icon: any; title: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white ${color}`}>
      <Icon className="w-4 h-4" /> {title}
    </div>
  );
}

export function ServerStatus() {
  const [unlocked, setUnlocked] = React.useState(isUnlocked());
  const [password, setPassword] = React.useState("");
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  const fetch = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/system-status");
      setData(res.data);
      setLastUpdate(new Date());
    } catch (e: any) {
      if (e?.response?.status === 401) { setUnlocked(false); }
      else toast.error("Error al obtener métricas del servidor");
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => {
    if (unlocked) {
      fetch();
      const interval = setInterval(fetch, 30000);
      return () => clearInterval(interval);
    }
  }, [unlocked, fetch]);

  const handleUnlock = async () => {
    try {
      if (await login(password)) { setUnlocked(true); setPassword(""); }
    } catch (e: any) {
      toast.error("Acceso denegado", { description: e.response?.data?.error || "Contraseña incorrecta" });
    }
  };

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Estado del Servidor</h3>
            <p className="text-xs text-slate-500 mt-1">Requiere contraseña de administrador</p>
          </div>
          <Input type="password" placeholder="Contraseña" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleUnlock()}
            className="rounded-xl text-center" />
          <Button onClick={handleUnlock} className="w-full rounded-xl bg-slate-900 hover:bg-black font-bold text-[10px] uppercase tracking-widest">
            Desbloquear
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCcw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const { sistema, almacenamiento, actividad, red, seguridad, rendimiento, costes, historico } = data;
  const ramPct = sistema.ram.pct;
  const diskPct = almacenamiento.disco.total ? Math.round(almacenamiento.disco.used / almacenamiento.disco.total * 100) : 0;
  const maxHourly = Math.max(...historico.hourly, 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-slate-900">Estado del Servidor</h3>
          {lastUpdate && <p className="text-[10px] text-slate-400 mt-0.5">Actualizado: {lastUpdate.toLocaleTimeString("es-ES")} · refresco cada 30s</p>}
        </div>
        <Button variant="outline" onClick={fetch} disabled={loading} className="rounded-xl text-[10px] font-bold uppercase tracking-widest h-9">
          <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refrescar
        </Button>
      </div>

      {/* ── Sistema ── */}
      <div className="space-y-3">
        <SectionHeader icon={Cpu} title="Sistema" color="bg-gradient-to-r from-slate-700 to-slate-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Cpu} label="CPU" value={`${sistema.cpu.usage.toFixed(1)}%`} sub={`${sistema.cpu.cores} cores · ${sistema.cpu.model.split(" ").slice(0, 3).join(" ")}`}
            color="text-blue-600" badge={sistema.cpu.usage > 80 ? "Alta" : "Normal"} badgeColor={sistema.cpu.usage > 80 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"} />
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-slate-50 text-violet-600"><Activity className="w-4 h-4" /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RAM</p>
                <p className="text-sm font-bold text-slate-900">{fmt(sistema.ram.used)} / {fmt(sistema.ram.total)}</p>
              </div>
            </div>
            <Bar pct={ramPct} color="bg-violet-500" />
            <p className="text-[10px] text-slate-400">{ramPct}% usado · {fmt(sistema.ram.free)} libre</p>
          </div>
          <StatCard icon={Clock} label="Uptime Servidor" value={fmtUptime(sistema.uptime.server)}
            sub={`Proceso: ${fmtUptime(sistema.uptime.process)}`} color="text-emerald-600" />
          <StatCard icon={Server} label="Entorno" value={sistema.node} sub={sistema.so}
            color="text-amber-600" badge={`PID ${sistema.pid}`} badgeColor="bg-slate-100 text-slate-600" />
        </div>
      </div>

      {/* ── Almacenamiento ── */}
      <div className="space-y-3">
        <SectionHeader icon={HardDrive} title="Almacenamiento" color="bg-gradient-to-r from-amber-500 to-orange-500" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disco</p>
              <span className="text-xs font-bold text-slate-600">{fmt(almacenamiento.disco.used)} / {fmt(almacenamiento.disco.total)}</span>
            </div>
            <Bar pct={diskPct} color="bg-amber-500" />
            <p className="text-[10px] text-slate-400">{diskPct}% ocupado · {fmt(almacenamiento.disco.free)} libre</p>
          </div>
          <StatCard icon={Database} label="Carpeta data/" value={fmt(almacenamiento.dataDir)}
            sub={`${almacenamiento.backups} backups guardados`} color="text-indigo-600" />
          <StatCard icon={Database} label="Carpeta logs/" value={fmt(almacenamiento.logsDir)}
            sub="Registros de auditoría" color="text-slate-600" />
        </div>
      </div>

      {/* ── Actividad ── */}
      <div className="space-y-3">
        <SectionHeader icon={BarChart3} title="Actividad de la App" color="bg-gradient-to-r from-indigo-600 to-purple-600" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { icon: Database, label: "Prompts biblioteca", value: actividad.prompts, color: "text-indigo-600" },
            { icon: TrendingUp, label: "Autoguardados", value: actividad.autosaves, color: "text-violet-600" },
            { icon: Activity, label: "Reg. auditoría", value: actividad.logEntries, color: "text-blue-600" },
            { icon: Zap, label: "Tokens procesados", value: actividad.tokens.toLocaleString("es-ES"), color: "text-amber-600" },
            { icon: HardDrive, label: "Archivos conv.", value: actividad.filesConverted, color: "text-emerald-600" },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className={`mx-auto w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center mb-2 ${item.color}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-extrabold text-slate-900">{item.value}</p>
              <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Red y servicios ── */}
      <div className="space-y-3">
        <SectionHeader icon={Globe} title="Red y Servicios" color="bg-gradient-to-r from-cyan-600 to-teal-600" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Globe} label="IP del Servidor" value={red.ip} sub={`Puerto ${red.puerto}`} color="text-cyan-600" />
          <StatCard icon={Activity} label="Peticiones hoy" value={red.reqToday} sub={`${red.reqWeek} esta semana`} color="text-teal-600" />
          <StatCard icon={Users} label="IPs únicas" value={red.uniqueIPs} sub="desde el último reinicio" color="text-indigo-600" />
          <StatCard icon={HardDrive} label="Ancho de banda" value={fmt(red.bandwidth)} sub="desde el último reinicio" color="text-slate-600" />
        </div>
        {/* Servicios */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Estado de servicios</p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "OpenAI API", ok: red.openai },
              { label: "Gemini API", ok: red.gemini },
              { label: "Admin Auth", ok: true },
              { label: "Base de Datos", ok: true },
              { label: "Backups", ok: almacenamiento.backups >= 0 },
            ].map(({ label, ok }) => (
              <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
                {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />} {label}
              </div>
            ))}
          </div>
        </div>
        {/* Top endpoints */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Endpoints más llamados</p>
          <div className="space-y-2">
            {red.topEndpoints.length === 0 && <p className="text-xs text-slate-400">Sin datos aún</p>}
            {red.topEndpoints.map(([ep, count]: [string, number], i: number) => {
              const maxCount = red.topEndpoints[0]?.[1] || 1;
              return (
                <div key={ep} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}</span>
                  <span className="text-xs font-mono text-slate-700 flex-1 truncate">{ep}</span>
                  <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Seguridad ── */}
      <div className="space-y-3">
        <SectionHeader icon={Shield} title="Seguridad" color="bg-gradient-to-r from-rose-600 to-pink-600" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={AlertTriangle} label="Fallos de login" value={seguridad.authFailures}
            color={seguridad.authFailures > 10 ? "text-rose-600" : "text-slate-500"}
            badge={seguridad.authFailures > 10 ? "Revisar" : "OK"}
            badgeColor={seguridad.authFailures > 10 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"} />
          <StatCard icon={Shield} label="Bloqueados rate limit" value={seguridad.rateLimitBlocks} color="text-amber-600" />
          <StatCard icon={Lock} label="Sesiones activas" value={seguridad.activeSessions} color="text-indigo-600" />
          <StatCard icon={CheckCircle2} label="Último acceso OK"
            value={seguridad.lastAuthSuccess.ip === "ninguna" ? "Ninguno" : seguridad.lastAuthSuccess.ip}
            sub={seguridad.lastAuthSuccess.timestamp ? new Date(seguridad.lastAuthSuccess.timestamp).toLocaleString("es-ES") : "—"}
            color="text-emerald-600" />
        </div>
      </div>

      {/* ── Rendimiento IA ── */}
      <div className="space-y-3">
        <SectionHeader icon={Zap} title="Rendimiento IA" color="bg-gradient-to-r from-violet-600 to-indigo-600" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Clock} label="Latencia media" value={`${rendimiento.avgLatency} ms`}
            sub="últimas 10 llamadas" color="text-violet-600"
            badge={rendimiento.avgLatency > 5000 ? "Lenta" : rendimiento.avgLatency > 0 ? "OK" : "Sin datos"}
            badgeColor={rendimiento.avgLatency > 5000 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"} />
          <StatCard icon={AlertTriangle} label="Latencia máxima" value={`${rendimiento.maxLatency} ms`} color="text-rose-500" />
          <StatCard icon={TrendingUp} label="Modelo más usado" value={rendimiento.topModel} color="text-indigo-600" />
          <StatCard icon={Activity} label="Total llamadas IA" value={rendimiento.totalCalls} sub="desde el último reinicio" color="text-slate-600" />
        </div>
      </div>

      {/* ── Costes ── */}
      <div className="space-y-3">
        <SectionHeader icon={Coins} title="Costes Estimados" color="bg-gradient-to-r from-amber-500 to-yellow-500" />
        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Proveedor activo</p>
              <p className="text-lg font-extrabold text-slate-900 mt-1">{costes.provider} / {costes.model}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Tokens totales</p>
              <p className="text-lg font-extrabold text-indigo-600 mt-1">{costes.totalTokens.toLocaleString("es-ES")}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Coste estimado total</p>
              <p className="text-lg font-extrabold text-amber-600 mt-1">~{fmtCost(costes.estimatedTotal)} €</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Orientativo · verifica en tu proveedor</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Histórico ── */}
      <div className="space-y-3">
        <SectionHeader icon={TrendingUp} title="Histórico de Actividad" color="bg-gradient-to-r from-emerald-600 to-teal-600" />

        {/* Gráfica por horas */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Prompts generados — últimas 24 horas</p>
          <div className="flex items-end gap-1 h-24">
            {historico.hourly.map((v: number, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t transition-all duration-500"
                  style={{
                    height: `${(v / maxHourly) * 80}px`,
                    minHeight: v > 0 ? "4px" : "0px",
                    background: v > 0 ? "linear-gradient(to top, #6366f1, #8b5cf6)" : "#f1f5f9",
                  }}
                />
                {i % 6 === 0 && <span className="text-[8px] text-slate-400">{23 - i}h</span>}
              </div>
            ))}
          </div>
          {historico.hourly.every((v: number) => v === 0) && (
            <p className="text-xs text-center text-slate-400 mt-2">Sin actividad en las últimas 24 horas</p>
          )}
        </div>

        {/* Actividad por días */}
        {Object.keys(historico.daily).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Actividad por día — última semana</p>
            <div className="space-y-2">
              {Object.entries(historico.daily).sort((a, b) => b[1] as number - (a[1] as number)).map(([day, count]) => {
                const maxDay = Math.max(...Object.values(historico.daily) as number[]);
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-28 flex-shrink-0">{day}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                        style={{ width: `${((count as number) / maxDay) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-6 text-right">{count as number}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
