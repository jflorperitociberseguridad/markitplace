// Configuración del proveedor de IA activo.
// Las API keys viven en el .env del servidor. El proveedor por defecto viene de DEFAULT_PROVIDER.

let _serverConfig: { defaultProvider: string; defaultModel: string } | null = null;

async function fetchServerConfig() {
  if (_serverConfig) return _serverConfig;
  try {
    const res = await fetch("/api/server-config");
    const data = await res.json();
    _serverConfig = {
      defaultProvider: data.defaultProvider || "openai",
      defaultModel: data.defaultModel || "gpt-4o",
    };
  } catch {
    _serverConfig = { defaultProvider: "openai", defaultModel: "gpt-4o" };
  }
  return _serverConfig;
}

export function getAIConfig() {
  const cached = _serverConfig;
  const provider = localStorage.getItem("AI_PROVIDER") || (cached?.defaultProvider ?? "openai");
  const model = localStorage.getItem("AI_MODEL") || (cached?.defaultModel ?? (provider === "openai" ? "gpt-4o" : provider === "claude" ? "claude-sonnet-4-6" : "gemini-2.0-flash"));
  return { provider, model };
}

// Limpia valores inválidos del localStorage para evitar pantallas en blanco
function sanitizeLocalStorage() {
  const validProviders = ["openai", "gemini", "claude"];
  const validThemes = ["light", "sepia", "indigo", "midnight"];

  const provider = localStorage.getItem("AI_PROVIDER");
  if (provider && !validProviders.includes(provider)) {
    localStorage.removeItem("AI_PROVIDER");
    localStorage.removeItem("AI_MODEL");
  }

  const theme = localStorage.getItem("APP_THEME");
  if (theme && !validThemes.includes(theme)) {
    localStorage.removeItem("APP_THEME");
  }

  // Limpiar token caducado (sessionStorage)
  const token = sessionStorage.getItem("ADMIN_TOKEN");
  if (token && token.length < 10) {
    sessionStorage.removeItem("ADMIN_TOKEN");
  }
}

export async function initAIConfig() {
  sanitizeLocalStorage();
  await fetchServerConfig();
  if (!localStorage.getItem("AI_PROVIDER") && _serverConfig) {
    localStorage.setItem("AI_PROVIDER", _serverConfig.defaultProvider);
    localStorage.setItem("AI_MODEL", _serverConfig.defaultModel);
  }
}

export const PROVIDER_MODELS = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o (Recomendado)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Rápido / Económico)" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Recomendado)" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Máxima calidad)" },
  ],
  claude: [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Recomendado)" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Rápido)" },
    { value: "claude-opus-4-6", label: "Claude Opus 4.6 (Máxima calidad)" },
  ],
};
