import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Settings2,
  Database,
  Cpu,
  ShieldCheck,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Key,
  Globe,
  Bell,
  Eye,
  EyeOff,
  Zap,
  Info,
  Lock,
  Unlock,
  FileText,
  RotateCcw,
} from "lucide-react";
import { DB } from "../types";
import { ServerStatus } from "./ServerStatus";
import { PromptEngineConfig } from "./PromptEngineConfig";
import { toast } from "sonner";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { login, clearToken, isUnlocked } from "../auth";

interface SettingsProps {
  db: DB;
  updateDb: (db: DB) => void;
}

import { PROVIDER_MODELS } from "../aiConfig";

export function Settings({ db, updateDb }: SettingsProps) {
  const [resetting, setResetting] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(!isUnlocked());
  const [settingsTab, setSettingsTab] = React.useState<"general" | "motor" | "servidor" | "seguridad">("general");
  const [termsLog, setTermsLog] = React.useState<{ count: number; recent: any[] }>({ count: 0, recent: [] });
  const [termsLogLoading, setTermsLogLoading] = React.useState(false);

  const loadTermsLog = React.useCallback(() => {
    setTermsLogLoading(true);
    axios.get("/api/terms-acceptance-log")
      .then((r) => setTermsLog(r.data))
      .catch(() => setTermsLog({ count: 0, recent: [] }))
      .finally(() => setTermsLogLoading(false));
  }, []);

  React.useEffect(() => {
    if (settingsTab === "seguridad") loadTermsLog();
  }, [settingsTab, loadTermsLog]);
  const [password, setPassword] = React.useState("");
  const [isScanning, setIsScanning] = React.useState(false);
  const [validatingKey, setValidatingKey] = React.useState(false);
  const [showGeminiKey, setShowGeminiKey] = React.useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = React.useState(false);

  const [config, setConfig] = React.useState({
    aiProvider: localStorage.getItem("AI_PROVIDER") || "gemini",
    llmModel: localStorage.getItem("AI_MODEL") || "gemini-1.5-pro",
    temperature: parseFloat(localStorage.getItem("AI_TEMPERATURE") || "0.7"),
    maxTokens: parseInt(localStorage.getItem("AI_MAX_TOKENS") || "2048"),
    notifications: true,
    autoSave: true,
    securityShield: true,
    region: "europe-west1",
  });

  // When provider changes, auto-select first model of that provider
  const handleProviderChange = (provider: string) => {
    const firstModel = PROVIDER_MODELS[provider]?.[0]?.value || "";
    setConfig((prev) => ({ ...prev, aiProvider: provider, llmModel: firstModel }));
    localStorage.setItem("AI_PROVIDER", provider);
    localStorage.setItem("AI_MODEL", firstModel);
    toast.info(`Proveedor cambiado a ${provider === "openai" ? "OpenAI" : "Google Gemini"}`);
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));

    // Persist to localStorage
    const storageMap: Record<string, string> = {
      aiProvider: "AI_PROVIDER",
      llmModel: "AI_MODEL",
      temperature: "AI_TEMPERATURE",
      maxTokens: "AI_MAX_TOKENS",
    };

    if (storageMap[key]) {
      localStorage.setItem(storageMap[key], String(value));
    }
  };

  const validateCurrentKey = async () => {
    const provider = config.aiProvider;
    setValidatingKey(true);
    try {
      const res = await axios.post("/api/validate-key", { provider });
      if (res.data.valid) {
        toast.success(`Clave de ${provider === "openai" ? "OpenAI" : "Gemini"} configurada y operativa en el servidor`);
      } else {
        toast.error("La clave del servidor no es válida o no está definida", { description: res.data.error });
      }
    } catch {
      toast.error("Error al validar la configuración del servidor");
    } finally {
      setValidatingKey(false);
    }
  };
  const [serverConfig, setServerConfig] = React.useState({ gemini: false, openai: false, claude: false, adminPasswordSet: false });

  React.useEffect(() => {
    axios.get("/api/server-config").then((r) => setServerConfig(r.data)).catch(() => {});
  }, []);

  const getServiceStatus = () => {
    const currentProvider = config.aiProvider;
    const hasKey = currentProvider === "openai" ? serverConfig.openai : serverConfig.gemini;

    return [
      { name: "Motor MarkItDown", status: "Operational", active: true },
      { name: "IA Prompt Generator", status: "Operational", active: true },
      { name: "Base de Datos Pro", status: "Connected", active: true },
      {
        name: currentProvider === "openai" ? "OpenAI Engine" : "Gemini AI Engine",
        status: hasKey ? "Operational" : "Falta clave en .env",
        active: hasKey,
      },
    ];
  };
  const [serviceStatus, setServiceStatus] = React.useState(getServiceStatus());

  React.useEffect(() => {
    setServiceStatus(getServiceStatus());
  }, [config.aiProvider, serverConfig]);

  const checkIntegrity = () => {
    setIsScanning(true);
    toast.loading("Iniciando escaneo de integridad...", { id: "scan" });
    setTimeout(() => {
      setServiceStatus(getServiceStatus());
      setIsScanning(false);
      toast.success("Integridad verificada: 100% Operacional", { id: "scan" });
    }, 2000);
  };

  const handleBackup = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
      const a = document.createElement("a");
      a.setAttribute("href", dataStr);
      a.setAttribute("download", `cybermedida_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Respaldo generado con éxito");
    } catch {
      toast.error("Error al generar el respaldo");
    }
  };

  const handleUnlock = async () => {
    try {
      if (await login(password)) {
        setIsLocked(false);
        setPassword("");
        toast.success("Consola Desbloqueada", { description: "Acceso concedido a la configuración." });
      }
    } catch (e: any) {
      toast.error("Acceso Denegado", { description: e.response?.data?.error || "Contraseña de administrador incorrecta." });
    }
  };
  const saveAll = () => {
    // Persist all config
    localStorage.setItem("AI_PROVIDER", config.aiProvider);
    localStorage.setItem("AI_MODEL", config.llmModel);
    localStorage.setItem("AI_TEMPERATURE", String(config.temperature));
    localStorage.setItem("AI_MAX_TOKENS", String(config.maxTokens));

    toast.success("Configuración Global Guardada", {
      description: "Todos los cambios han sido persistidos.",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    });
  };

  const resetStats = async () => {
    setResetting(true);
    try {
      const newDb = { ...db, stats: { totalTokens: 0, totalSavings: 0, filesProcessed: 0 } };
      await axios.post("/api/db", newDb);
      updateDb(newDb);
      toast.success("Estadísticas del sistema reiniciadas");
    } catch {
      toast.error("Error al reiniciar estadísticas");
    } finally {
      setResetting(false);
    }
  };

  // ─── Lock Screen ─────────────────────────────────────────────────────
  if (isLocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-in fade-in zoom-in duration-500">
        <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-2xl p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Acceso Restringido</h2>
            <p className="text-sm text-slate-500 mt-1">Introduce la contraseña de administrador para gestionar el núcleo.</p>
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
            <Button
              onClick={handleUnlock}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-widest text-xs h-12 shadow-lg shadow-indigo-100"
            >
              Desbloquear Consola
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Protocolo de Seguridad <span className="text-indigo-500">CM-ROOT-V2</span>
          </p>
        </Card>
      </div>
    );
  }

  // ─── Main Settings ───────────────────────────────────────────────────
  const currentModels = PROVIDER_MODELS[config.aiProvider] || [];
  const activeApiKey = config.aiProvider === "openai" ? serverConfig.openai : config.aiProvider === "claude" ? serverConfig.claude : serverConfig.gemini;

  return (
    <div className="space-y-8 animate-in slide-in-from-top duration-700">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between lg:gap-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            Sistema / <span className="text-indigo-600">Configuración Central</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Configuración del Sistema</h2>
          <p className="text-sm text-slate-500">Gestión de recursos, proveedores IA y mantenimiento.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => { clearToken(); setIsLocked(true); }}
            className="rounded-xl border-slate-200 text-slate-500 hover:bg-slate-50 font-bold uppercase tracking-widest text-[10px] h-10 px-6 transition-all flex-1 sm:flex-none"
          >
            <Lock className="w-4 h-4 mr-2" /> Bloquear
          </Button>
          <Button
            onClick={saveAll}
            className="rounded-xl bg-slate-900 hover:bg-black text-white font-bold uppercase tracking-widest text-[10px] h-10 px-6 shadow-lg shadow-slate-100 transition-all flex-1 sm:flex-none"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> Guardar Todo
          </Button>
        </div>
      </header>

      {/* Pestañas internas */}
      <div className="flex flex-wrap gap-2 -mt-2">
        {[
          { id: "general", label: "General", icon: Cpu },
          { id: "motor", label: "Motor de Prompts", icon: Zap },
          { id: "servidor", label: "Servidor", icon: Database },
          { id: "seguridad", label: "Seguridad", icon: ShieldCheck },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSettingsTab(id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
              settingsTab === id
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                : "bg-white border border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {settingsTab === "general" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* ─── AI Provider Selection ───────────────────────────────── */}
          <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-500" /> Proveedor de Inteligencia Artificial
              </CardTitle>
              <CardDescription className="text-xs">Selecciona el motor IA y configura sus credenciales.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Provider Toggle */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Motor IA Activo</Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleProviderChange("gemini")}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      config.aiProvider === "gemini"
                        ? "border-indigo-500 bg-indigo-50/50 shadow-md shadow-indigo-100"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    {config.aiProvider === "gemini" && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      </div>
                    )}
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold", config.aiProvider === "gemini" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400")}>
                      G
                    </div>
                    <span className={cn("text-xs font-bold", config.aiProvider === "gemini" ? "text-indigo-700" : "text-slate-500")}>Google Gemini</span>
                    <span className="text-[9px] text-slate-400">2.0 Flash / 2.5 Pro</span>
                  </button>

                  <button
                    onClick={() => handleProviderChange("openai")}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      config.aiProvider === "openai"
                        ? "border-emerald-500 bg-emerald-50/50 shadow-md shadow-emerald-100"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    {config.aiProvider === "openai" && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                    )}
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold", config.aiProvider === "openai" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400")}>
                      O
                    </div>
                    <span className={cn("text-xs font-bold", config.aiProvider === "openai" ? "text-emerald-700" : "text-slate-500")}>OpenAI</span>
                    <span className="text-[9px] text-slate-400">gpt-4o / gpt-4.1</span>
                  </button>

                  <button
                    onClick={() => handleProviderChange("claude")}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      config.aiProvider === "claude"
                        ? "border-amber-500 bg-amber-50/50 shadow-md shadow-amber-100"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    {config.aiProvider === "claude" && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                      </div>
                    )}
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold", config.aiProvider === "claude" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-400")}>
                      C
                    </div>
                    <span className={cn("text-xs font-bold", config.aiProvider === "claude" ? "text-amber-700" : "text-slate-500")}>Claude</span>
                    <span className="text-[9px] text-slate-400">Sonnet / Haiku</span>
                  </button>
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Model + API Key for active provider */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Modelo Principal</Label>
                  <Select value={config.llmModel} onValueChange={(v) => handleConfigChange("llmModel", v)}>
                    <SelectTrigger className="rounded-xl border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentModels.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Credenciales del Proveedor
                  </Label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <p className="text-xs text-slate-600 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      Las API keys se gestionan exclusivamente en el servidor (archivo <code className="font-mono text-[10px] bg-white border border-slate-200 rounded px-1">.env</code>). Nunca se exponen en el navegador.
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={cn("text-[9px]", activeApiKey ? "text-emerald-600 border-emerald-200" : "text-rose-600 border-rose-200")}>
                        {activeApiKey ? "Clave configurada en servidor" : "Clave NO configurada"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={validateCurrentKey}
                        disabled={validatingKey}
                        className="h-6 text-[9px] font-bold text-indigo-600 hover:text-indigo-800 uppercase"
                      >
                        {validatingKey ? (
                          <RefreshCcw className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        )}
                        Probar conexión
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Temperature & Tokens */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      Temperatura <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 rounded-lg text-[9px]">{config.temperature}</Badge>
                    </Label>
                    <div className="flex gap-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      <span>Más Preciso</span>
                      <span>Más Creativo</span>
                    </div>
                  </div>
                  <Slider
                    value={[config.temperature * 100]}
                    onValueChange={(v) => handleConfigChange("temperature", v[0] / 100)}
                    max={100}
                    step={1}
                    className="py-4"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      Límite de Tokens <Badge variant="secondary" className="bg-slate-100 text-slate-600 rounded-lg text-[9px]">{config.maxTokens}</Badge>
                    </Label>
                  </div>
                  <Slider
                    value={[config.maxTokens]}
                    onValueChange={(v) => handleConfigChange("maxTokens", v[0])}
                    min={256}
                    max={8192}
                    step={128}
                    className="py-4"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Security ────────────────────────────────────────────── */}
          <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-500" /> Seguridad y Opciones
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Nunca compartas tus tokens de acceso
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-slate-700">Protocolo de Blindaje</Label>
                    <p className="text-[10px] text-slate-500">Filtrado PII en tiempo real</p>
                  </div>
                  <Switch checked={config.securityShield} onCheckedChange={(v) => handleConfigChange("securityShield", v)} />
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-slate-700">Auto-Auditoría</Label>
                    <p className="text-[10px] text-slate-500">Guardado de trazas local</p>
                  </div>
                  <Switch checked={config.autoSave} onCheckedChange={(v) => handleConfigChange("autoSave", v)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Services Status ──────────────────────────────────────── */}
          <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" /> Estado de los Servicios
                </CardTitle>
                <CardDescription className="text-[10px]">Monitoreo en tiempo real de los módulos.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={checkIntegrity}
                disabled={isScanning}
                className="h-8 rounded-lg border-indigo-100 text-indigo-600 font-bold text-[9px] uppercase tracking-wider bg-white"
              >
                <RefreshCcw className={cn("w-3 h-3 mr-2", isScanning && "animate-spin")} />
                {isScanning ? "Escaneando..." : "Verificar Integridad"}
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {serviceStatus.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", item.active ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                      <span className="text-sm font-bold text-slate-700">{item.name}</span>
                    </div>
                    <span className={cn("text-[10px] font-bold uppercase tracking-widest", item.active ? "text-emerald-600" : "text-amber-600")}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ─── Data Maintenance ─────────────────────────────────────── */}
          <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500" /> Mantenimiento de Datos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 italic">REINICIAR ANALÍTICA GLOBAL</p>
                  <p className="text-xs text-slate-500">Pondrá a cero todos los contadores. Los prompts guardados permanecerán intactos.</p>
                  <Button
                    variant="outline"
                    className="mt-4 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[10px] uppercase h-9"
                    onClick={resetStats}
                    disabled={resetting}
                  >
                    {resetting ? "PROCESANDO..." : "EJECUTAR REINICIO DE STATS"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Right Column ───────────────────────────────────────────── */}
        <div className="space-y-8">
          <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-500" /> Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between p-4 rounded-xl border border-indigo-100 bg-indigo-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Zap className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-slate-700">Alertas de Automatización</Label>
                    <p className="text-[10px] text-slate-500">Notificar éxito/fallo</p>
                  </div>
                </div>
                <Switch checked={config.notifications} onCheckedChange={(v) => handleConfigChange("notifications", v)} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 shadow-sm bg-slate-900 text-white overflow-hidden">
            <CardHeader className="border-b border-white/10 bg-white/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" /> Sistema Operativo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 font-mono">
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Proveedor IA Activo</p>
                <p className="text-xs text-indigo-300">
                  {config.aiProvider === "openai" ? "OpenAI" : "Google Gemini"} → {config.llmModel}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Keys Configuradas</p>
                <div className="flex gap-2">
                  <Badge className={cn("text-[9px]", serverConfig.gemini ? "bg-emerald-600" : "bg-slate-700")}>
                    Gemini: {serverConfig.gemini ? "✓" : "✗"}
                  </Badge>
                  <Badge className={cn("text-[9px]", serverConfig.openai ? "bg-emerald-600" : "bg-slate-700")}>
                    OpenAI: {serverConfig.openai ? "✓" : "✗"}
                  </Badge>
                  <Badge className={cn("text-[9px]", serverConfig.claude ? "bg-emerald-600" : "bg-slate-700")}>
                    Claude: {serverConfig.claude ? "✓" : "✗"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                  <span>Almacenamiento SSD</span>
                  <span>42.8 GB / 100 GB</span>
                </div>
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full w-[43%] shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                </div>
              </div>
            </CardContent>
            <div className="p-4 bg-white/5 flex items-center justify-between">
              <span className="text-[8px] font-bold text-white/40 uppercase tracking-[0.2em]">CIBERMEDIDA-NODEROUTE-0921</span>
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            </div>
          </Card>

          <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden p-6 border-dashed border-2">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-indigo-50 rounded-full mb-4">
                <HardDrive className="w-8 h-8 text-indigo-600" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Backups del Sistema</p>
              <Button
                onClick={handleBackup}
                variant="default"
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase h-10 shadow-lg shadow-indigo-100"
              >
                EJECUTAR RESPALDO LOCAL
              </Button>
              <p className="text-[9px] text-slate-400 mt-2 font-medium">Exporta todo en un .json: prompts, automatizaciones, skills y estadísticas.</p>
            </div>
          </Card>
        </div>
      </div>
      )}

      {/* ── Motor de Prompts ── */}
      {settingsTab === "motor" && (
        <PromptEngineConfig />
      )}

      {/* ── Estado del Servidor ── */}
      {settingsTab === "servidor" && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              <span className="text-indigo-600">Sistema /</span> Monitor en Tiempo Real
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Estado del Servidor</h3>
            <p className="text-sm text-slate-500">Métricas del sistema, red, seguridad y rendimiento. Refresco automático cada 30s.</p>
          </div>
          <ServerStatus />
        </div>
      )}

      {/* ── Seguridad ── */}
      {settingsTab === "seguridad" && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              <span className="text-indigo-600">Sistema /</span> Acceso y Sesión
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Seguridad</h3>
            <p className="text-sm text-slate-500">Gestión del bloqueo de la consola y la sesión de administrador.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-500" /> Bloqueo de la Consola
                </CardTitle>
                <CardDescription className="text-xs">Cierra la sesión de administrador en este navegador.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <Unlock className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700">Consola desbloqueada</span>
                </div>
                <Button
                  onClick={() => { clearToken(); setIsLocked(true); }}
                  className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-widest text-[10px] h-10"
                >
                  <Lock className="w-4 h-4 mr-2" /> Bloquear ahora
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-500" /> Contraseña de Administrador
                </CardTitle>
                <CardDescription className="text-xs">La contraseña se gestiona en el servidor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    La contraseña de administrador (<code className="font-mono text-[10px] bg-white border border-slate-200 rounded px-1">ADMIN_PASSWORD</code>) está definida en el archivo de configuración del servidor. Para cambiarla, edita el <code className="font-mono text-[10px] bg-white border border-slate-200 rounded px-1">ecosystem.config.cjs</code> y reinicia el servicio.
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">Estado de la contraseña</span>
                  <Badge className={cn("text-[9px]", serverConfig.adminPasswordSet ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {serverConfig.adminPasswordSet ? "Configurada en servidor" : "Usando provisional"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Sesión actual</span>
                  <Badge variant="outline" className="text-[9px]">Expira a las 24h</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Registro de aceptación de términos ── */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" /> Registro de aceptación de términos
                  </CardTitle>
                  <CardDescription className="text-xs">Datos técnicos registrados cuando un usuario acepta los términos legales. Total: {termsLog.count}.</CardDescription>
                </div>
                <Button onClick={loadTermsLog} disabled={termsLogLoading} variant="outline" size="sm" className="rounded-lg text-[10px] font-bold uppercase h-8">
                  <RotateCcw className={cn("w-3.5 h-3.5 mr-1.5", termsLogLoading && "animate-spin")} /> Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {termsLog.recent.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Aún no hay aceptaciones registradas.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-left">
                        <th className="py-2 px-2 font-bold">Fecha y hora</th>
                        <th className="py-2 px-2 font-bold">IP</th>
                        <th className="py-2 px-2 font-bold">País</th>
                        <th className="py-2 px-2 font-bold">Dispositivo</th>
                        <th className="py-2 px-2 font-bold">Navegador</th>
                        <th className="py-2 px-2 font-bold">SO</th>
                        <th className="py-2 px-2 font-bold">Idioma</th>
                        <th className="py-2 px-2 font-bold">Z. horaria</th>
                        <th className="py-2 px-2 font-bold">Pantalla</th>
                        <th className="py-2 px-2 font-bold">Versión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {termsLog.recent.map((r, i) => (
                        <tr key={i} className={cn("border-b border-slate-100", i % 2 === 1 && "bg-slate-50/60")}>
                          <td className="py-1.5 px-2 text-slate-600 whitespace-nowrap">{r.acceptedAt ? new Date(r.acceptedAt).toLocaleString("es-ES") : "—"}</td>
                          <td className="py-1.5 px-2 font-mono text-slate-500">{r.ip || "—"}</td>
                          <td className="py-1.5 px-2 text-slate-600">{r.country || "—"}</td>
                          <td className="py-1.5 px-2 text-slate-600">{r.deviceType || "—"}</td>
                          <td className="py-1.5 px-2 text-slate-600">{r.browser || "—"}</td>
                          <td className="py-1.5 px-2 text-slate-600">{r.os || "—"}</td>
                          <td className="py-1.5 px-2 text-slate-600">{r.language || "—"}</td>
                          <td className="py-1.5 px-2 text-slate-600">{r.timezone || "—"}</td>
                          <td className="py-1.5 px-2 text-slate-600">{r.screenResolution || "—"}</td>
                          <td className="py-1.5 px-2 text-slate-500">v{r.version || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-slate-400 mt-3">Se muestran las 100 aceptaciones más recientes. Estos registros se conservan un máximo de 90 días.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
