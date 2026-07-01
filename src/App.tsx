import React from "react";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { PromptGenerator } from "./components/PromptGenerator";
import { AutomationHub } from "./components/AutomationHub";
import { SkillBuilder } from "./components/SkillBuilder";
import { MarkdownDownloader } from "./components/MarkdownDownloader";
import { JsonBuilder } from "./components/JsonBuilder";
import { TermsGate } from "./components/TermsGate";
import { Settings } from "./components/Settings";
import { PromptLog } from "./components/PromptLog";
import { THEMES, Theme } from "./themes";
import { installAuthInterceptor } from "./auth";
import { initAIConfig } from "./aiConfig";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { DB } from "./types";
import axios from "axios";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

installAuthInterceptor();
initAIConfig();

export default function App() {
  const [theme, setTheme] = React.useState<Theme>(() => (localStorage.getItem("APP_THEME") as Theme) || "light");

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("APP_THEME", theme);
  }, [theme]);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [db, setDb] = useState<DB | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on tab change (mobile)
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  // Fetch DB on mount
  useEffect(() => {
    const fetchDb = async () => {
      try {
        const res = await axios.get("/api/db");
        setDb({
          prompts: res.data.prompts || [],
          automations: res.data.automations || [],
          skills: res.data.skills || [],
          markdowns: res.data.markdowns || [],
          jsons: res.data.jsons || [],
          stats: res.data.stats || { totalTokens: 0, totalSavings: 0, filesProcessed: 0 },
        });
      } catch (err) {
        console.error("Failed to fetch DB:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDb();
  }, []);

  const updateDb = async (newDb: DB) => {
    setDb(newDb);
    try {
      await axios.post("/api/db", newDb);
    } catch (err: any) {
      console.error("Failed to save DB:", err);
      if (err?.response?.status === 401) {
        toast.error("Sesión requerida", { description: "Desbloquea la consola en Configuración para guardar cambios." });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Iniciando PromptCore...</div>
        </div>
      </div>
    );
  }

  if (!db) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <div className="text-rose-500 font-bold">FATAL ERROR: DB CONNECTION FAILED</div>
          <p className="text-sm text-slate-500 max-w-md">No se pudo conectar con el motor de base de datos de CyberMedida. Por favor, reinicia el servidor.</p>
        </div>
      </div>
    );
  }

  return (
    <TermsGate>
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans relative">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        theme={theme}
        setTheme={setTheme}
      />
      
      <main className="flex-1 overflow-auto relative">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white">P</div>
            <h1 className="text-slate-900 font-bold tracking-tight text-lg">PromptCore</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-slate-500"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </header>

        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          {activeTab === "dashboard" && <Dashboard db={db!} onNavigate={setActiveTab} />}
          {activeTab === "prompts" && <PromptGenerator db={db!} updateDb={updateDb} />}
          {activeTab === "automation" && <AutomationHub db={db!} updateDb={updateDb} />}
          {activeTab === "skills" && <SkillBuilder db={db!} updateDb={updateDb} />}
          {activeTab === "markdown" && <MarkdownDownloader db={db!} updateDb={updateDb} />}
          {activeTab === "json" && <JsonBuilder db={db!} updateDb={updateDb} />}
          {activeTab === "promptlog" && <PromptLog />}
          {activeTab === "settings" && <Settings db={db!} updateDb={updateDb} />}
        </div>
      </main>
      
      <Toaster position="bottom-right" richColors />
    </div>
    </TermsGate>
  );
}

