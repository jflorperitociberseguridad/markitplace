import { cn } from "@/lib/utils";
import { THEMES, Theme } from "../themes";
import { 
  LayoutDashboard, 
  Terminal, 
  Zap, 
  FileText, 
  History, 
  Settings,
  ChevronRight,
  Activity,
  Wrench,
  Braces,
  ExternalLink
} from "lucide-react";
import cibermedidaIcon from "../assets/cibermedida-icon.png";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export function Sidebar({ activeTab, setActiveTab, isOpen, onClose, theme, setTheme }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Panel de Control", icon: LayoutDashboard },
    { id: "prompts", label: "Lab de Prompts", icon: Terminal },
    { id: "automation", label: "Automatizaciones", icon: Zap },
    { id: "skills", label: "Constructor de Skills", icon: Wrench },
    { id: "json", label: "JSON Builder", icon: Braces },
    { id: "markdown", label: "MarkDown Pro", icon: FileText },
    { id: "promptlog", label: "Registro de Actividad", icon: History },
    { id: "settings", label: "Configuración", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <div className={cn(
        "fixed lg:static inset-y-0 left-0 w-64 bg-slate-900 text-slate-400 flex flex-col h-full flex-shrink-0 z-50 shadow-2xl transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">P</div>
            <h1 className="text-white font-bold tracking-tight text-xl">PromptCore</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-all relative group overflow-hidden border border-transparent",
                activeTab === item.id 
                  ? "bg-slate-800 text-white shadow-sm" 
                  : "hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-indigo-400" : "text-slate-500")} />
              <span className="font-semibold tracking-tight">{item.label}</span>
              {activeTab === item.id && (
                <ChevronRight className="w-3 h-3 ml-auto text-indigo-400 opacity-50" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          {/* Selector de tema */}
          <div className="mb-3 bg-slate-800/50 rounded-xl p-2">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Tema</p>
            <div className="grid grid-cols-2 gap-1">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                    theme === t.id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-700 hover:text-white"
                  )}
                >
                  <span>{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4">
            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2">Uso de Tokens</p>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
              <div className="bg-indigo-500 h-full w-[64%] shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            </div>
            <p className="text-white text-xs font-medium">124,500 <span className="text-slate-500 font-normal">/ 200k Tokens</span></p>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-800/60 px-2">
            <div className="flex items-center gap-2 mb-2">
              <img src={cibermedidaIcon} alt="Cibermedida" className="w-7 h-7 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white text-xs font-bold leading-tight truncate">Cibermedida</p>
                <p className="text-slate-500 text-[9px] leading-tight">Proyecto de docencia.cibermedida.es</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <a href="https://cibermedida.es" target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-400 transition-colors">
                cibermedida.es <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a href="https://docencia.cibermedida.es" target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-400 transition-colors">
                docencia.cibermedida.es <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <p className="text-slate-600 text-[9px] mt-2">Junio 2026</p>
          </div>

          <div className="mt-3 flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Activity className="w-4 h-4" />
              v2.4.0
            </div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" title="Sistema Online"></div>
          </div>
        </div>
      </div>
    </>
  );
}
