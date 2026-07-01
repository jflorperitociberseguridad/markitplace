import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Cpu, Save, RotateCcw, RefreshCcw, Lock, Sliders, Globe, Sparkles, Info } from "lucide-react";
import { isUnlocked, login } from "../auth";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import axios from "axios";

interface EngineConfig {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  language: "es" | "en";
}

export function PromptEngineConfig() {
  const [unlocked, setUnlocked] = React.useState(isUnlocked());
  const [password, setPassword] = React.useState("");
  const [config, setConfig] = React.useState<EngineConfig | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const fetchConfig = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/prompt-config");
      setConfig(res.data);
      setDirty(false);
    } catch (e: any) {
      if (e?.response?.status === 401) setUnlocked(false);
      else toast.error("Error al cargar la configuración");
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => {
    if (unlocked) fetchConfig();
  }, [unlocked, fetchConfig]);

  const handleUnlock = async () => {
    try {
      if (await login(password)) { setUnlocked(true); setPassword(""); }
    } catch (e: any) {
      toast.error("Acceso denegado", { description: e.response?.data?.error || "Contraseña incorrecta" });
    }
  };

  const update = (patch: Partial<EngineConfig>) => {
    setConfig(c => c ? { ...c, ...patch } : c);
    setDirty(true);
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await axios.post("/api/prompt-config", config);
      toast.success("Configuración guardada", { description: "Se aplicará en las próximas generaciones" });
      setDirty(false);
    } catch {
      toast.error("Error al guardar");
    } finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm("¿Restaurar el prompt del sistema y los parámetros por defecto?")) return;
    try {
      const res = await axios.post("/api/prompt-config/reset");
      setConfig(res.data.config);
      setDirty(false);
      toast.success("Restaurado a valores por defecto");
    } catch {
      toast.error("Error al restaurar");
    }
  };

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Motor de Prompts</h3>
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

  if (!config) {
    return <div className="flex justify-center py-12"><RefreshCcw className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            <Sparkles className="w-3 h-3 text-indigo-500" /> Motor de Generación
          </div>
          <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Configuración del Prompt del Sistema</h3>
          <p className="text-sm text-slate-500">Personaliza cómo la IA genera los prompts. Los cambios afectan a todos los usuarios.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Badge className="bg-amber-100 text-amber-700 text-[9px]">Cambios sin guardar</Badge>}
          <Button variant="outline" onClick={reset} className="rounded-xl text-[10px] font-bold uppercase h-9">
            <RotateCcw className="w-4 h-4 mr-1" /> Restaurar
          </Button>
          <Button onClick={save} disabled={saving || !dirty} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase h-9">
            {saving ? <RefreshCcw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar
          </Button>
        </div>
      </div>

      {/* Parámetros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Temperatura */}
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-violet-500" /> Temperatura
            </CardTitle>
            <CardDescription className="text-xs">Creatividad vs consistencia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{config.temperature.toFixed(1)}</span>
              <Badge variant="outline" className="text-[9px]">
                {config.temperature <= 0.3 ? "Muy preciso" : config.temperature <= 0.6 ? "Equilibrado" : config.temperature <= 0.9 ? "Creativo" : "Muy creativo"}
              </Badge>
            </div>
            <input
              type="range" min="0.1" max="1.0" step="0.1"
              value={config.temperature}
              onChange={e => update({ temperature: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400">
              <span>0.1 Preciso</span><span>1.0 Creativo</span>
            </div>
            <p className="text-[10px] text-slate-400">Para clase y resultados consistentes: 0.3-0.4. Para ideas creativas: 0.7-0.9.</p>
          </CardContent>
        </Card>

        {/* Idioma */}
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-500" /> Idioma de salida
            </CardTitle>
            <CardDescription className="text-xs">Idioma de los prompts generados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={config.language} onValueChange={(v: "es" | "en") => update({ language: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">🇪🇸 Español</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-400">Define en qué idioma se generan los prompts por defecto.</p>
          </CardContent>
        </Card>

        {/* Max tokens */}
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-500" /> Longitud máxima
            </CardTitle>
            <CardDescription className="text-xs">Tokens de salida</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{config.maxTokens}</span>
              <Badge variant="outline" className="text-[9px]">~{Math.round(config.maxTokens * 0.75)} palabras</Badge>
            </div>
            <input
              type="range" min="512" max="4096" step="256"
              value={config.maxTokens}
              onChange={e => update({ maxTokens: parseInt(e.target.value) })}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400">
              <span>512 Corto</span><span>4096 Largo</span>
            </div>
            <p className="text-[10px] text-slate-400">2048 es suficiente para la mayoría de prompts.</p>
          </CardContent>
        </Card>
      </div>

      {/* Editor del prompt del sistema */}
      <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" /> Prompt del Sistema (instrucciones para la IA)
          </CardTitle>
          <CardDescription className="text-xs">
            Estas instrucciones le dicen a la IA cómo debe generar los prompts. Edítalo con cuidado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Este texto se envía como instrucción de sistema en cada generación. Incluye el contexto de Cibermedida,
              los 13 tipos de prompt y las reglas de salida. Si lo dejas vacío, la IA generará sin guía específica.
            </p>
          </div>
          <Textarea
            value={config.systemPrompt}
            onChange={e => update({ systemPrompt: e.target.value })}
            className="rounded-xl min-h-[360px] font-mono text-xs leading-relaxed"
            placeholder="Instrucciones del sistema..."
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{config.systemPrompt.length} caracteres · ~{Math.ceil(config.systemPrompt.length / 4)} tokens</span>
            <span>Se aplica en todas las generaciones del Lab de Prompts</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
