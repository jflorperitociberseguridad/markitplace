import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Send, RefreshCcw, Copy, Check, Bot, User, Wand2,
  MessageSquareText, Save, Lightbulb,
} from "lucide-react";
import { DB, SavedPrompt } from "../types";
import { getAIConfig } from "../aiConfig";
import { toast } from "sonner";
import axios from "axios";
import { cn } from "@/lib/utils";

interface PromptAgentProps {
  db: DB;
  updateDb: (db: DB) => void;
  onPromptGenerated?: (prompt: string) => void;
}

interface Message {
  role: "user" | "model";
  text: string;
}

// Detecta si el mensaje del agente contiene el prompt final (marcado por el backend)
function extractFinalPrompt(text: string): string | null {
  const match = text.match(/\[PROMPT_FINAL\]([\s\S]*?)\[\/PROMPT_FINAL\]/);
  return match ? match[1].trim() : null;
}
// Limpia las etiquetas para mostrar el texto al usuario
function cleanForDisplay(text: string): string {
  return text.replace(/\[PROMPT_FINAL\]|\[\/PROMPT_FINAL\]/g, "").trim();
}

const IDEAS_EJEMPLO = [
  "Quiero un prompt para vender un curso de Excel para adultos.",
  "Necesito crear una práctica de Excel para alumnos principiantes.",
  "Quiero una campaña de marketing para una academia de formación.",
  "Un prompt para generar una imagen de portada para un curso online.",
];

export function PromptAgent({ db, updateDb, onPromptGenerated }: PromptAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [promptSent, setPromptSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  // El último prompt final detectado en la conversación
  const finalPrompt = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "model") {
        const fp = extractFinalPrompt(messages[i].text);
        if (fp) return fp;
      }
    }
    return null;
  })();

  // ── Efecto: cuando se genera el prompt final, enviarlo al panel compilado ──
  useEffect(() => {
    if (finalPrompt && !promptSent && onPromptGenerated) {
      onPromptGenerated(finalPrompt);
      setPromptSent(true);
      // Guardar automáticamente en historial
      pushToHistory(finalPrompt);
      toast.success("Prompt enviado al panel compilado");
    }
  }, [finalPrompt, promptSent, onPromptGenerated]);

  // ── Guardar en historial ──
  const pushToHistory = async (content: string) => {
    try {
      await axios.post("/api/prompt-history", { content, label: "Agente Guiado" });
    } catch (error) {
      // Silenciar erro de historial, no afecta al flujo principal
      console.error("Error guardando en historial:", error);
    }
  };

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const userMessage: Message = { role: "user", text: clean };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText("");
    setStarted(true);
    setIsThinking(true);
    try {
      const { provider, model } = getAIConfig();
      const response = await axios.post("/api/prompt-agent", {
        messages,
        text: clean,
        provider,
        model,
      });
      setMessages([...newMessages, { role: "model", text: response.data.text || "(sin respuesta)" }]);
    } catch (error: any) {
      toast.error("Error del agente", { description: error.response?.data?.details || error.message });
      setMessages([...newMessages, { role: "model", text: "Ha ocurrido un error. Inténtalo de nuevo." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setStarted(false);
    setInputText("");
    setPromptSent(false);
  };

  const copyPrompt = () => {
    if (!finalPrompt) return;
    navigator.clipboard.writeText(finalPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Prompt copiado");
  };

  const savePrompt = () => {
    if (!finalPrompt) return;
    const newPrompt: SavedPrompt = {
      id: Math.random().toString(36).substr(2, 9),
      title: (messages[0]?.text || "Prompt del agente").slice(0, 40),
      content: finalPrompt,
      type: "advanced",
      tags: ["agente"],
      category: "Engineering",
      isFavorite: false,
      createdAt: Date.now(),
    };
    updateDb({ ...db, prompts: [newPrompt, ...db.prompts] });
    toast.success("Prompt guardado en el Hub");
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
      <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col h-[560px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {!started && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="p-4 bg-indigo-50 rounded-2xl mb-4">
                <Sparkles className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-1">Convierte una idea en un prompt profesional</h3>
              <p className="text-sm text-slate-500 mb-5 max-w-md">Empieza escribiendo lo que quieres conseguir. No hace falta que lo tengas claro: el agente te guiará con preguntas.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {IDEAS_EJEMPLO.map((idea, i) => (
                  <button key={i} onClick={() => send(idea)}
                    className="text-xs text-slate-600 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-lg px-3 py-2 transition-colors text-left max-w-[240px]">
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isFinal = m.role === "model" && extractFinalPrompt(m.text);
            return (
              <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "model" && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-indigo-600" />
                  </div>
                )}
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                  m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700")}>
                  <p className="whitespace-pre-wrap leading-relaxed">{cleanForDisplay(m.text)}</p>
                  {isFinal && (
                    <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                      <Check className="w-3 h-3" /> Enviado al panel compilado
                    </div>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                )}
              </div>
            );
          })}

          {isThinking && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="bg-slate-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-100 p-3">
          <div className="flex gap-2">
            <Textarea
              placeholder="Escribe tu respuesta o una idea..."
              className="rounded-xl border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-11 min-h-0 py-2.5 text-sm flex-1"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(inputText); } }}
            />
            <Button onClick={() => send(inputText)} disabled={isThinking || !inputText.trim()}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11 w-11 p-0 flex-shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {started && (
            <button onClick={reset} className="mt-2 text-[10px] font-bold text-slate-400 hover:text-rose-600 uppercase tracking-wider flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> Empezar de nuevo
            </button>
          )}
        </div>
      </Card>

      {/* Ayuda cuando no hay prompt final */}
      {!finalPrompt && started && (
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              <MessageSquareText className="w-3.5 h-3.5" /> Método C.R.E.F.O.
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">El agente está construyendo tu prompt con los 5 bloques: <strong>C</strong>ontexto, <strong>R</strong>ol, <strong>E</strong>specíficos, <strong>F</strong>ormato y <strong>O</strong>bjetivo. Cuando lo termine, aparecerá en el panel derecha.</p>
          </CardContent>
        </Card>
      )}

      {/* Ayuda inicial */}
      {!started && (
        <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              <Lightbulb className="w-3.5 h-3.5" /> Cómo funciona
            </div>
            <ol className="space-y-2 text-xs text-slate-600">
              <li className="flex gap-2"><span className="font-bold text-indigo-600">1.</span> Escribe una idea simple de lo que quieres conseguir.</li>
              <li className="flex gap-2"><span className="font-bold text-indigo-600">2.</span> El agente te hace preguntas, una a una.</li>
              <li className="flex gap-2"><span className="font-bold text-indigo-600">3.</span> Cuando tiene lo necesario, genera el prompt final.</li>
              <li className="flex gap-2"><span className="font-bold text-indigo-600">4.</span> El prompt aparece en <strong>Resultado Compilado</strong> (derecha).</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
