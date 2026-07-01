import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import os from "os";
import { execSync } from "child_process";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import JSZip from "jszip";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Seguridad: contraseña de administración (definir en .env) ─────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Cibermedida2026!";
if (!process.env.ADMIN_PASSWORD) {
  console.warn("[AVISO] ADMIN_PASSWORD no definida en .env — usando contraseña provisional. Cámbiala en producción.");
}

// Tokens de sesión en memoria (expiran a las 24h o al reiniciar PM2)
const sessions = new Map<string, number>(); // token -> expiry timestamp
const SESSION_TTL = 24 * 60 * 60 * 1000;

function createSession(): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function isValidToken(token?: string): boolean {
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!isValidToken(token)) {
    return res.status(401).json({ error: "No autorizado. Desbloquea la consola en Configuración." });
  }
  next();
}

// ─── Proveedores de IA (claves SOLO en el servidor, vía .env) ──────────
let genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY no está definida en el .env del servidor");
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

let openAIClient: OpenAI | null = null;
function getOpenAI() {
  if (!openAIClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no está definida en el .env del servidor");
    openAIClient = new OpenAI({ apiKey });
  }
  return openAIClient;
}


let anthropicClient: Anthropic | null = null;
function getAnthropic() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está definida en el .env del servidor");
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// Generación unificada
async function generateAIContent(options: {
  provider: string;
  model?: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const { provider, model, prompt, systemPrompt, temperature = 0.7, maxTokens = 2048 } = options;

  if (provider === "claude") {
    const anthropic = getAnthropic();
    const msgs: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
    const response = await anthropic.messages.create({
      model: model || "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt || undefined,
      messages: msgs,
      temperature,
    });
    return (response.content[0] as any)?.text || "";
  }

  if (provider === "openai") {
    const openai = getOpenAI();
    const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
    msgs.push({ role: "user", content: prompt });

    const response = await openai.chat.completions.create({
      model: model || "gpt-4o",
      messages: msgs,
      temperature,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content || "";
  }

  // Gemini
  const ai = getGenAI();
  const geminiModel = ai.getGenerativeModel({
    model: model || "gemini-2.0-flash",
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  });
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}

// Chat unificado
async function chatAI(options: {
  provider: string;
  model?: string;
  messages: Array<{ role: string; text: string }>;
  newMessage: string;
  systemPrompt: string;
  temperature?: number;
}): Promise<string> {
  const { provider, model, messages, newMessage, systemPrompt, temperature = 0.7 } = options;

  if (provider === "claude") {
    const anthropic = getAnthropic();
    const chatMsgs: Anthropic.MessageParam[] = [];
    for (const m of messages) {
      chatMsgs.push({ role: m.role === "user" ? "user" : "assistant", content: m.text });
    }
    chatMsgs.push({ role: "user", content: newMessage });
    const response = await anthropic.messages.create({
      model: model || "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: chatMsgs,
      temperature,
    });
    return (response.content[0] as any)?.text || "";
  }

  if (provider === "openai") {
    const openai = getOpenAI();
    const chatMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];
    for (const m of messages) {
      chatMsgs.push({ role: m.role === "user" ? "user" : "assistant", content: m.text });
    }
    chatMsgs.push({ role: "user", content: newMessage });

    const response = await openai.chat.completions.create({
      model: model || "gpt-4o",
      messages: chatMsgs,
      temperature,
    });
    return response.choices[0]?.message?.content || "";
  }

  // Gemini
  const ai = getGenAI();
  const geminiModel = ai.getGenerativeModel({
    model: model || "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });
  const history = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));
  const chat = geminiModel.startChat({ history });
  const result = await chat.sendMessage(newMessage);
  return result.response.text();
}


// ─── Contadores de métricas en memoria ──────────────────────────────────────
interface RequestStat {
  endpoint: string;
  ip: string;
  bytes: number;
  timestamp: number;
}
interface AILatency {
  provider: string;
  model: string;
  ms: number;
  timestamp: number;
}
const reqStats: RequestStat[] = [];
const aiLatencies: AILatency[] = [];
let authFailures = 0;
let rateLimitBlocks = 0;
let lastAuthSuccess = { ip: "ninguna", timestamp: 0 };

function trackRequest(req: any, bytes = 0) {
  reqStats.push({ endpoint: req.path, ip: req.ip || "?", bytes, timestamp: Date.now() });
  if (reqStats.length > 10000) reqStats.splice(0, 1000);
}
function trackAILatency(provider: string, model: string, ms: number) {
  aiLatencies.push({ provider, model, ms, timestamp: Date.now() });
  if (aiLatencies.length > 200) aiLatencies.splice(0, 100);
}
function getDirSize(dirPath: string): number {
  try {
    const result = execSync(`du -sb "${dirPath}" 2>/dev/null || echo 0`, { encoding: "utf-8" });
    return parseInt(result.split("\t")[0]) || 0;
  } catch { return 0; }
}
function formatBytes(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + " MB";
  return (b / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

// ─── Datos ──────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const LOGS_DIR = path.join(__dirname, "logs");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PROMPT_LOG_FILE = path.join(LOGS_DIR, "prompt-log.json");
const AUTOSAVE_FILE = path.join(DATA_DIR, "autosave.json");
const PROMPT_CONFIG_FILE = path.join(DATA_DIR, "prompt-config.json");
const TERMS_ACCEPTANCE_FILE = path.join(DATA_DIR, "terms-acceptance.json");
const PROMPT_HISTORY_FILE = path.join(DATA_DIR, "prompt-history.json");

[DATA_DIR, UPLOADS_DIR, BACKUPS_DIR, LOGS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      {
        prompts: [],
        automations: [],
        stats: { totalTokens: 0, totalSavings: 0, filesProcessed: 0 },
      },
      null,
      2
    )
  );
}

if (!fs.existsSync(PROMPT_LOG_FILE)) {
  fs.writeFileSync(PROMPT_LOG_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(AUTOSAVE_FILE)) {
  fs.writeFileSync(AUTOSAVE_FILE, JSON.stringify([], null, 2));
}

// Respaldo automático de db.json (conserva los últimos 20)
function backupDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(DB_FILE, path.join(BACKUPS_DIR, `db-${stamp}.json`));
    const backups = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith("db-"))
      .sort();
    while (backups.length > 20) {
      const oldest = backups.shift();
      if (oldest) fs.unlinkSync(path.join(BACKUPS_DIR, oldest));
    }
  } catch (e) {
    console.error("Backup error:", e);
  }
}

// ─── Registro de auditoría de prompts ───────────────────────────────────
interface PromptLogEntry {
  id: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  timestamp: string; // ISO
  ip: string;
  endpoint: string;
  provider: string;
  model: string;
  prompt: string;
  // Datos técnicos de navegación
  country?: string;
  userAgent?: string;
  sessionId?: string;
  timezone?: string;
  language?: string;
  screenResolution?: string;
  deviceType?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
}

function logPrompt(req: express.Request, endpoint: string, provider: string, model: string, promptText: string) {
  try {
    const now = new Date();
    const meta = (req.body && req.body.__clientMeta) || {};
    const country =
      (req.headers["cf-ipcountry"] as string) ||
      (req.headers["x-vercel-ip-country"] as string) ||
      (req.headers["x-country-code"] as string) ||
      "desconocido";
    const entry: PromptLogEntry = {
      id: crypto.randomBytes(6).toString("hex"),
      fecha: now.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" }),
      hora: now.toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour12: false }),
      timestamp: now.toISOString(),
      ip: req.ip || "desconocida",
      endpoint,
      provider,
      model: model || "default",
      prompt: String(promptText).slice(0, 5000),
      country,
      userAgent: (req.headers["user-agent"] as string) || "desconocido",
      sessionId: meta.sessionId || "",
      timezone: meta.timezone || "",
      language: meta.language || "",
      screenResolution: meta.screenResolution || "",
      deviceType: meta.deviceType || "",
      browser: meta.browser || "",
      browserVersion: meta.browserVersion || "",
      os: meta.os || "",
    };
    const log: PromptLogEntry[] = JSON.parse(fs.readFileSync(PROMPT_LOG_FILE, "utf-8"));
    log.unshift(entry);
    // Conservar como máximo 5000 registros
    if (log.length > 5000) log.length = 5000;
    fs.writeFileSync(PROMPT_LOG_FILE, JSON.stringify(log, null, 2));
  } catch (e) {
    console.error("Prompt log error:", e);
  }
}


// ─── Autoguardado silencioso de prompts generados ───────────────────────────
interface AutosaveEntry {
  id: string;
  fecha: string;
  hora: string;
  timestamp: string;
  ip: string;
  provider: string;
  model: string;
  topic: string;
  prompt: string;
}

function autosavePrompt(req: express.Request, provider: string, model: string, topic: string, promptText: string) {
  try {
    const now = new Date();
    const entry: AutosaveEntry = {
      id: crypto.randomBytes(6).toString("hex"),
      fecha: now.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" }),
      hora: now.toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour12: false }),
      timestamp: now.toISOString(),
      ip: req.ip || "desconocida",
      provider,
      model: model || "default",
      topic: String(topic).slice(0, 200),
      prompt: String(promptText).slice(0, 10000),
    };
    const data: AutosaveEntry[] = JSON.parse(fs.readFileSync(AUTOSAVE_FILE, "utf-8"));
    data.unshift(entry);
    if (data.length > 500) data.length = 500;
    fs.writeFileSync(AUTOSAVE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Autosave error:", e);
  }
}


// ─── Configuración dinámica del motor de prompts ────────────────────────────
interface PromptEngineConfig {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  language: "es" | "en";
}

const DEFAULT_SYSTEM_PROMPT = `Eres el motor de ingeniería de prompts de PromptCore, herramienta formativa de Cibermedida (España).

CONTEXTO:
- Los usuarios son formadores, alumnos adultos y profesionales con nivel técnico básico-medio
- Los prompts deben estar en español de España, salvo que se indique otro idioma
- El objetivo es crear prompts claros, accionables y profesionales

TIPOS DE PROMPT disponibles (aplica el más adecuado según la tarea):
- Zero-shot: tarea directa sin ejemplos
- One-shot: un ejemplo antes de la tarea
- Few-shot: varios ejemplos para enseñar el patrón
- Role: asignar un papel a la IA
- Chain-of-thought: razonar paso a paso
- Instruction: instrucción detallada y estructurada
- Contextual: incluir contexto relevante
- Comparación: comparar dos o más opciones
- Clasificación: ordenar elementos en categorías
- Generación: crear contenido nuevo desde cero
- Revisión: corregir o mejorar un texto existente
- Extracción: sacar datos concretos de un texto
- Transformación: cambiar el formato o estilo de un contenido

REGLAS DE SALIDA:
1. Devuelve SOLO el prompt final, sin explicaciones ni metacomentarios
2. Empieza con el rol si aplica ("Actúa como...")
3. Estructura: Rol → Contexto → Instrucción → Formato de salida → Restricciones
4. Máximo 250 palabras salvo que se pida más detalle
5. Usa delimitadores (###, """) cuando haya contenido a procesar
6. Adapta automáticamente el tipo de prompt más adecuado según la tarea`;

const DEFAULT_PROMPT_CONFIG: PromptEngineConfig = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.4,
  maxTokens: 2048,
  language: "es",
};

function loadPromptConfig(): PromptEngineConfig {
  try {
    if (fs.existsSync(PROMPT_CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(PROMPT_CONFIG_FILE, "utf-8"));
      return { ...DEFAULT_PROMPT_CONFIG, ...raw };
    }
  } catch { /* usa defaults */ }
  return { ...DEFAULT_PROMPT_CONFIG };
}

function savePromptConfig(config: Partial<PromptEngineConfig>) {
  const current = loadPromptConfig();
  const merged = { ...current, ...config };
  fs.writeFileSync(PROMPT_CONFIG_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

// ─── Subida de archivos: límite 10 MB y tipos permitidos ───────────────
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".json", ".csv"];
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) cb(null, true);
    else cb(new Error(`Tipo de archivo no permitido: ${ext}`));
  },
});

// ─── Servidor ───────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Necesario tras Nginx para que req.ip sea la IP real del cliente
  app.set("trust proxy", 1);

  app.use(express.json({ limit: "2mb" }));

  // Middleware de métricas
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.on("finish", () => {
      const bytes = parseInt(res.getHeader("content-length") as string || "0") || 0;
      trackRequest(req, bytes);
    });
    next();
  });

  // Rate limit para endpoints de IA: 20 peticiones/min por IP
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas peticiones. Espera un minuto." },
    handler: (req: express.Request, res: express.Response) => { rateLimitBlocks++; res.status(429).json({ error: "Demasiadas peticiones. Espera un minuto." }); },
  });

  // Rate limit para login: 10 intentos/15min por IP
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos de acceso. Espera 15 minutos." },
    handler: (req: express.Request, res: express.Response) => { authFailures++; rateLimitBlocks++; res.status(429).json({ error: "Demasiados intentos de acceso. Espera 15 minutos." }); },
  });


  // ─── API REST Documentada (Swagger) ─────────────────────────────────────
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "PromptCore API",
        version: "2.4.0",
        description: "API REST de PromptCore — Cibermedida. Los endpoints protegidos requieren Bearer token obtenido en /api/auth.",
        contact: { name: "Cibermedida", url: "https://cibermedida.es" },
      },
      servers: [{ url: "/", description: "Servidor actual" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
    apis: [],
  });

  // Añadir paths manualmente
  (swaggerSpec as any).paths = {
    "/api/health": {
      get: { summary: "Estado del servidor", tags: ["Sistema"], responses: { "200": { description: "OK" } } },
    },
    "/api/auth": {
      post: {
        summary: "Autenticación — obtener token de sesión",
        tags: ["Auth"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { password: { type: "string" } }, required: ["password"] } } } },
        responses: { "200": { description: "Token de sesión (24h)" }, "401": { description: "Contraseña incorrecta" } },
      },
    },
    "/api/server-config": {
      get: { summary: "Configuración pública del servidor (proveedores disponibles)", tags: ["Sistema"], responses: { "200": { description: "Config" } } },
    },
    "/api/generate-prompt": {
      post: {
        summary: "Generar prompt con IA (framework P.I.C.A.R.D. o clásico)",
        tags: ["IA"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
          topic: { type: "string", description: "Instrucción principal" },
          audience: { type: "string" }, format: { type: "string" }, style: { type: "string" },
          provider: { type: "string", enum: ["openai", "gemini", "claude"] },
          model: { type: "string" },
          picard: { type: "object", description: "Campos P.I.C.A.R.D. opcionales" },
        }, required: ["topic"] } } } },
        responses: { "200": { description: "Prompt generado" }, "429": { description: "Rate limit" } },
      },
    },
    "/api/prompt-tools": {
      post: {
        summary: "Herramientas sobre un prompt: evaluar, refinar, explicar, ejecutar",
        tags: ["IA"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
          action: { type: "string", enum: ["evaluate", "refine", "explain", "run"] },
          prompt: { type: "string" },
          provider: { type: "string" }, model: { type: "string" },
        }, required: ["action", "prompt"] } } } },
        responses: { "200": { description: "Resultado de la herramienta" } },
      },
    },
    "/api/automation-chat": {
      post: {
        summary: "Chat con el Arquitecto de Automatización IA",
        tags: ["IA"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
          messages: { type: "array" }, text: { type: "string" },
          provider: { type: "string" }, model: { type: "string" },
        } } } } },
        responses: { "200": { description: "Respuesta del chat" } },
      },
    },
    "/api/transform": {
      post: {
        summary: "Transformar Markdown a código en un lenguaje de programación",
        tags: ["IA"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
          markdown: { type: "string" }, language: { type: "string" },
          provider: { type: "string" }, model: { type: "string" },
        } } } } },
        responses: { "200": { description: "Código generado" } },
      },
    },
    "/api/convert": {
      post: {
        summary: "Convertir archivo (PDF, DOCX, TXT, CSV) a Markdown",
        tags: ["Archivos"],
        requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } },
        responses: { "200": { description: "Markdown extraído" }, "400": { description: "Archivo inválido o demasiado grande" } },
      },
    },
    "/api/db": {
      get: { summary: "Leer base de datos (prompts, automatizaciones, stats)", tags: ["Datos"], responses: { "200": { description: "DB completa" } } },
      post: {
        summary: "Escribir base de datos — REQUIERE AUTH",
        tags: ["Datos"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "OK" }, "401": { description: "No autorizado" } },
      },
    },
    "/api/autosave": {
      get: {
        summary: "Leer prompts autoguardados — REQUIERE AUTH",
        tags: ["Datos"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de entradas autoguardadas" } },
      },
      delete: {
        summary: "Vaciar autoguardado — REQUIERE AUTH",
        tags: ["Datos"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/prompt-log": {
      get: {
        summary: "Registro de auditoría de prompts — REQUIERE AUTH",
        tags: ["Auditoría"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de registros" } },
      },
      delete: {
        summary: "Vaciar registro — REQUIERE AUTH",
        tags: ["Auditoría"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/system-status": {
      get: {
        summary: "Métricas completas del servidor — REQUIERE AUTH",
        tags: ["Sistema"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Métricas del sistema, red, seguridad, rendimiento" } },
      },
    },
    "/api/validate-key": {
      post: {
        summary: "Validar conexión con proveedor de IA configurado en servidor",
        tags: ["Sistema"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { provider: { type: "string", enum: ["openai", "gemini", "claude"] } } } } } },
        responses: { "200": { description: "{ valid: true|false }" } },
      },
    },
  };

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "PromptCore API Docs",
  }));

  // ─── Auth ────────────────────────────────────────────────────────────
  app.post("/api/auth", authLimiter, (req, res) => {
    const { password } = req.body || {};
    if (typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ error: "Contraseña requerida" });
    }
    const ok =
      password.length === ADMIN_PASSWORD.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD));
    if (!ok) { authFailures++; return res.status(401).json({ error: "Contraseña incorrecta" }); }
    const token = createSession();
    lastAuthSuccess = { ip: req.ip || "?", timestamp: Date.now() };
    res.json({ token, expiresIn: SESSION_TTL });
  });

  // Health
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Estado de configuración del servidor (sin exponer claves)
  app.get("/api/server-config", (_req, res) => {
    const defaultProvider = process.env.DEFAULT_PROVIDER || "openai";
    const defaultModel = process.env.DEFAULT_MODEL ||
      (defaultProvider === "openai" ? "gpt-4o" : "gemini-2.0-flash");
    res.json({
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      claude: Boolean(process.env.ANTHROPIC_API_KEY),
      adminPasswordSet: Boolean(process.env.ADMIN_PASSWORD),
      defaultProvider,
      defaultModel,
    });
  });

  // ─── DB (lectura abierta para que la app funcione; escritura protegida) ─
  app.get("/api/db", (_req, res) => {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    res.json(data);
  });

  app.post("/api/db", requireAuth, (req, res) => {
    backupDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(req.body, null, 2));
    res.json({ status: "ok" });
  });

  // ─── Registro de prompts (solo admin) ────────────────────────────────
  app.get("/api/prompt-log", requireAuth, (_req, res) => {
    const log = JSON.parse(fs.readFileSync(PROMPT_LOG_FILE, "utf-8"));
    res.json(log);
  });

  app.delete("/api/prompt-log", requireAuth, (_req, res) => {
    fs.writeFileSync(PROMPT_LOG_FILE, JSON.stringify([], null, 2));
    res.json({ status: "ok" });
  });



  // ─── Estado del servidor ────────────────────────────────────────────────
  app.get("/api/system-status", requireAuth, async (_req, res) => {
    try {
      const now = Date.now();
      const dayAgo = now - 86400000;
      const weekAgo = now - 7 * 86400000;

      // Sistema
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const uptime = os.uptime();
      const nodeUptime = process.uptime();

      // CPU usage (1s sample)
      const cpuUsage = (() => {
        try {
          const result = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'", { encoding: "utf-8", timeout: 2000 });
          return parseFloat(result.trim()) || 0;
        } catch { return 0; }
      })();

      // Disco
      const diskInfo = (() => {
        try {
          const result = execSync("df -B1 /var/www/markitplace 2>/dev/null | tail -1", { encoding: "utf-8" });
          const parts = result.trim().split(/\s+/);
          return { total: parseInt(parts[1]) || 0, used: parseInt(parts[2]) || 0, free: parseInt(parts[3]) || 0 };
        } catch { return { total: 0, used: 0, free: 0 }; }
      })();

      // Tamaños de directorios
      const dataSize = getDirSize(DATA_DIR);
      const logsSize = getDirSize(LOGS_DIR);
      const backupCount = fs.existsSync(BACKUPS_DIR) ? fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith(".json")).length : 0;

      // Actividad de la app
      const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      const autosaveData = fs.existsSync(AUTOSAVE_FILE) ? JSON.parse(fs.readFileSync(AUTOSAVE_FILE, "utf-8")) : [];
      const logData = fs.existsSync(PROMPT_LOG_FILE) ? JSON.parse(fs.readFileSync(PROMPT_LOG_FILE, "utf-8")) : [];

      // Red
      const reqToday = reqStats.filter(r => r.timestamp > dayAgo);
      const reqWeek = reqStats.filter(r => r.timestamp > weekAgo);
      const uniqueIPs = [...new Set(reqStats.map(r => r.ip))];
      const endpointCounts: Record<string, number> = {};
      reqStats.forEach(r => { endpointCounts[r.endpoint] = (endpointCounts[r.endpoint] || 0) + 1; });
      const topEndpoints = Object.entries(endpointCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const totalBytes = reqStats.reduce((s, r) => s + r.bytes, 0);

      // Seguridad
      const activeSessions = [...sessions.entries()].filter(([, exp]) => exp > now).length;

      // Rendimiento IA
      const recent10 = aiLatencies.slice(-10);
      const avgLatency = recent10.length ? Math.round(recent10.reduce((s, l) => s + l.ms, 0) / recent10.length) : 0;
      const maxLatency = aiLatencies.length ? Math.max(...aiLatencies.map(l => l.ms)) : 0;
      const modelCounts: Record<string, number> = {};
      aiLatencies.forEach(l => { modelCounts[l.model] = (modelCounts[l.model] || 0) + 1; });
      const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "ninguno";

      // Costes estimados (tokens acumulados en db.stats)
      const totalTokens = db.stats?.totalTokens || 0;
      const PRICES: Record<string, { in: number; out: number }> = {
        "gemini-2.0-flash": { in: 0.10, out: 0.40 }, "gemini-2.5-flash": { in: 0.15, out: 0.60 },
        "gpt-4o": { in: 2.50, out: 10.0 }, "gpt-4o-mini": { in: 0.15, out: 0.60 }, "gpt-4.1": { in: 2.00, out: 8.0 },
      };
      const defProvider = process.env.DEFAULT_PROVIDER || "openai";
      const defModel = process.env.DEFAULT_MODEL || "gpt-4o";
      const defPrice = PRICES[defModel] || { in: 1.0, out: 4.0 };
      const estimatedCost = (totalTokens / 1_000_000) * (defPrice.in + defPrice.out);

      // Historial actividad por horas (últimas 24h)
      const hourlyActivity: number[] = new Array(24).fill(0);
      logData.forEach((e: any) => {
        const ts = new Date(e.timestamp).getTime();
        if (ts > dayAgo) {
          const hoursAgo = Math.floor((now - ts) / 3600000);
          if (hoursAgo < 24) hourlyActivity[23 - hoursAgo]++;
        }
      });

      // Días con más uso (últimos 7)
      const dailyActivity: Record<string, number> = {};
      logData.forEach((e: any) => {
        const ts = new Date(e.timestamp).getTime();
        if (ts > weekAgo) {
          const day = new Date(e.timestamp).toLocaleDateString("es-ES");
          dailyActivity[day] = (dailyActivity[day] || 0) + 1;
        }
      });

      // IP del servidor
      const serverIP = (() => {
        const ifaces = os.networkInterfaces();
        for (const iface of Object.values(ifaces)) {
          for (const addr of iface || []) {
            if (addr.family === "IPv4" && !addr.internal) return addr.address;
          }
        }
        return "127.0.0.1";
      })();

      res.json({
        sistema: {
          cpu: { usage: cpuUsage, cores: cpus.length, model: cpus[0]?.model || "desconocido" },
          ram: { total: totalMem, used: usedMem, free: freeMem, pct: Math.round(usedMem / totalMem * 100) },
          uptime: { server: uptime, process: nodeUptime },
          node: process.version,
          so: `${os.type()} ${os.release()}`,
          pid: process.pid,
        },
        almacenamiento: {
          disco: diskInfo,
          dataDir: dataSize,
          logsDir: logsSize,
          backups: backupCount,
        },
        actividad: {
          prompts: db.prompts?.length || 0,
          autosaves: autosaveData.length,
          logEntries: logData.length,
          tokens: totalTokens,
          filesConverted: db.stats?.filesProcessed || 0,
        },
        red: {
          ip: serverIP,
          puerto: process.env.PORT || "3002",
          reqToday: reqToday.length,
          reqWeek: reqWeek.length,
          uniqueIPs: uniqueIPs.length,
          topEndpoints,
          bandwidth: totalBytes,
          openai: Boolean(process.env.OPENAI_API_KEY),
          gemini: Boolean(process.env.GEMINI_API_KEY),
        },
        seguridad: {
          authFailures,
          rateLimitBlocks,
          activeSessions,
          lastAuthSuccess,
        },
        rendimiento: {
          avgLatency,
          maxLatency,
          topModel,
          totalCalls: aiLatencies.length,
        },
        costes: {
          totalTokens,
          estimatedTotal: estimatedCost,
          provider: defProvider,
          model: defModel,
        },
        historico: {
          hourly: hourlyActivity,
          daily: dailyActivity,
        },
      });
    } catch (err) {
      res.status(500).json({ error: "Error obteniendo métricas", details: String(err) });
    }
  });


  // ─── Stats públicas (sin auth) para el Dashboard ────────────────────────
  // ─── Términos de Uso y Política de Privacidad ───────────────────────────
  const TERMS_VERSION = "1.1";
  const TERMS_DATE = "24 de junio de 2026";
  const TERMS_CONTENT = `# Documentación legal de MarkItPlace Cibermedida

**Última actualización:** 24 de junio de 2026  
**Sitio web:** markitplace.cibermedida.es  
**Responsable:** Francisco Javier Flor González  
**Correo de contacto:** jfloradmin@cibermedida.es  
**Ámbito:** España y Unión Europea

---

## 1. Aviso legal

### 1.1 Identificación del titular

En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico, se informa de que el sitio web **markitplace.cibermedida.es** es titularidad de **Francisco Javier Flor González**, en adelante, el **Titular** o el **Responsable**.

Para cualquier cuestión relacionada con el uso de la plataforma, privacidad, protección de datos, ejercicio de derechos o incidencias legales, el usuario puede contactar mediante el correo electrónico:

**jfloradmin@cibermedida.es**

### 1.2 Objeto del sitio web

La plataforma tiene como finalidad permitir al usuario realizar consultas asistidas mediante sistemas de inteligencia artificial. El servicio puede ofrecer respuestas, explicaciones, textos, orientaciones, resúmenes, propuestas, análisis o contenidos generados automáticamente a partir de la información introducida por el usuario.

La plataforma está destinada exclusivamente a fines informativos, educativos, orientativos, tecnológicos o de apoyo al usuario. Las respuestas generadas no sustituyen el asesoramiento profesional cualificado.

### 1.3 Aceptación del aviso legal

El acceso, navegación o utilización de la plataforma implica que el usuario ha leído, comprende y acepta el presente Aviso Legal, los Términos y Condiciones de Uso, la Política de Privacidad y, en su caso, la Política de Cookies.

Si el usuario no está de acuerdo con cualquiera de estas condiciones, deberá abstenerse de utilizar la plataforma.

---

## 2. Términos y condiciones de uso

### 2.1 Naturaleza del servicio

MarkItPlace Cibermedida permite realizar consultas mediante herramientas de inteligencia artificial. Para generar las respuestas, la plataforma puede utilizar proveedores tecnológicos externos, entre ellos:

- OpenAI / ChatGPT.
- Google / Gemini.
- Anthropic / Claude.

El proveedor concreto utilizado puede variar según la configuración técnica, disponibilidad, rendimiento, coste, calidad de respuesta o selección realizada por la plataforma.

### 2.2 Uso permitido

El usuario se compromete a utilizar la plataforma de forma lícita, responsable y conforme a la legislación española y europea aplicable.

El usuario podrá utilizar la plataforma para:

- Realizar consultas informativas.
- Obtener orientación general.
- Generar textos o ideas de apoyo.
- Resolver dudas tecnológicas, educativas o profesionales de carácter general.
- Solicitar ayuda para organizar, resumir o explicar información.

### 2.3 Usos prohibidos

Queda prohibido utilizar la plataforma para:

- Cometer actos ilícitos o facilitar su comisión.
- Generar contenido fraudulento, engañoso, difamatorio o ilegal.
- Suplantar la identidad de terceros.
- Introducir datos personales de terceros sin autorización.
- Introducir información especialmente sensible sin necesidad o sin base legal suficiente.
- Solicitar instrucciones para vulnerar sistemas, cuentas, dispositivos o redes.
- Crear malware, phishing, campañas de fraude o herramientas de abuso.
- Realizar automatizaciones masivas no autorizadas.
- Sobrecargar, degradar o interferir en el funcionamiento de la plataforma.
- Eludir controles técnicos, medidas de seguridad o limitaciones de uso.

### 2.4 Registro de actividad y trazabilidad

Para garantizar la seguridad, trazabilidad, auditoría, prevención de abusos, mejora del servicio y cumplimiento normativo, la plataforma puede registrar datos técnicos y operativos asociados al uso del servicio.

Estos registros pueden incluir, entre otros:

- Dirección IP.
- Fecha y hora de acceso.
- Navegador utilizado.
- Sistema operativo.
- Identificador técnico de sesión.
- Páginas o secciones utilizadas.
- Consultas, preguntas o prompts introducidos.
- Respuestas generadas por la inteligencia artificial.
- Eventos técnicos.
- Errores del sistema.
- Incidencias de seguridad.
- Información necesaria para detectar abuso, fraude o uso indebido.

El usuario acepta que la utilización de la plataforma implica el tratamiento de estos datos en los términos descritos en esta documentación.

### 2.5 Recomendación sobre datos sensibles

El usuario no debe introducir en la plataforma información especialmente sensible, confidencial o innecesaria para la consulta, incluyendo, sin carácter limitativo:

- Datos de salud.
- Datos biométricos.
- Datos financieros completos.
- Contraseñas.
- Claves API.
- Documentos de identidad.
- Datos de menores.
- Información penal.
- Información sindical, religiosa, ideológica o política.
- Datos personales de terceros sin autorización.

Si el usuario introduce voluntariamente este tipo de información, lo hará bajo su propia responsabilidad, salvo que exista una finalidad legítima, proporcionada y conforme a la normativa aplicable.

### 2.6 Carácter orientativo de las respuestas

Las respuestas generadas mediante inteligencia artificial pueden contener errores, omisiones, información incompleta, información desactualizada o interpretaciones incorrectas.

El usuario reconoce que las respuestas:

- No constituyen asesoramiento jurídico, fiscal, médico, financiero, laboral, contable ni profesional certificado.
- No deben utilizarse como única base para tomar decisiones relevantes.
- Deben verificarse con fuentes oficiales o profesionales cualificados cuando puedan afectar a derechos, obligaciones, salud, economía, seguridad o relaciones jurídicas.

El Titular no garantiza la exactitud absoluta, actualidad, integridad o adecuación de las respuestas generadas.

### 2.7 Disponibilidad del servicio

El Titular realizará esfuerzos razonables para mantener la plataforma disponible y operativa. No obstante, no se garantiza una disponibilidad permanente, continua o libre de errores.

El servicio puede verse interrumpido por:

- Mantenimiento técnico.
- Actualizaciones.
- Incidencias del servidor.
- Fallos de proveedores externos.
- Problemas de conectividad.
- Causas de fuerza mayor.
- Medidas de seguridad.

### 2.8 Modificación del servicio

El Titular podrá modificar, ampliar, reducir, suspender o eliminar funcionalidades de la plataforma cuando resulte necesario por motivos técnicos, legales, organizativos, de seguridad o de mejora del servicio.

### 2.9 Suspensión o limitación de acceso

El Titular podrá bloquear, limitar o suspender el acceso a la plataforma cuando detecte:

- Uso abusivo.
- Actividad automatizada no autorizada.
- Intentos de ataque.
- Incumplimiento de estos términos.
- Riesgo para la seguridad del sistema.
- Uso contrario a la ley o a derechos de terceros.

---

## 3. Política de privacidad

### 3.1 Responsable del tratamiento

El responsable del tratamiento de los datos personales tratados a través de la plataforma es:

**Francisco Javier Flor González**  
**Correo electrónico:** jfloradmin@cibermedida.es

### 3.2 Datos personales tratados

La plataforma puede tratar las siguientes categorías de datos:

#### Datos técnicos

- Dirección IP.
- Fecha y hora de acceso.
- Tipo y versión de navegador.
- Sistema operativo.
- Idioma del navegador.
- Identificadores técnicos de sesión.
- Información básica del dispositivo.
- Datos de registro de errores.
- Datos de seguridad y trazabilidad.

#### Datos de interacción

- Consultas realizadas por el usuario.
- Prompts introducidos.
- Respuestas generadas.
- Secuencia de interacción.
- Contenido de las acciones realizadas dentro de la plataforma.

#### Datos derivados del uso

- Frecuencia de uso.
- Número de consultas.
- Eventos de funcionamiento.
- Información agregada o estadística.
- Datos necesarios para prevenir abusos o usos indebidos.

La plataforma no está diseñada para recoger datos especialmente protegidos. El usuario debe evitar introducir datos sensibles o información confidencial innecesaria.

### 3.3 Finalidades del tratamiento

Los datos se tratan para las siguientes finalidades:

#### Prestación del servicio

Permitir que el usuario realice consultas y obtenga respuestas generadas mediante inteligencia artificial.

#### Seguridad informática

Detectar, prevenir y corregir:

- Accesos no autorizados.
- Ataques informáticos.
- Uso abusivo.
- Intentos de fraude.
- Automatizaciones maliciosas.
- Incidencias técnicas.

#### Auditoría y trazabilidad

Mantener registros que permitan verificar qué acciones se han realizado, cuándo se han producido y qué respuesta ha generado el sistema.

#### Mejora del servicio

Analizar el funcionamiento de la plataforma, corregir errores, mejorar la calidad de las respuestas y optimizar la experiencia de uso.

#### Cumplimiento legal

Atender obligaciones legales, requerimientos administrativos, judiciales o de autoridades competentes.

#### Defensa de derechos e intereses legítimos

Conservar información necesaria para gestionar reclamaciones, resolver disputas, acreditar uso indebido o defender los intereses legítimos del Titular.

### 3.4 Base jurídica del tratamiento

El tratamiento de datos se fundamenta en las siguientes bases jurídicas:

#### Ejecución del servicio solicitado

Artículo 6.1.b del Reglamento General de Protección de Datos. El tratamiento es necesario para permitir al usuario utilizar la plataforma y recibir respuestas generadas mediante inteligencia artificial.

#### Interés legítimo

Artículo 6.1.f del Reglamento General de Protección de Datos. El Titular tiene un interés legítimo en garantizar la seguridad, prevenir abusos, mantener la trazabilidad, corregir errores y mejorar la calidad del servicio.

#### Cumplimiento de obligaciones legales

Artículo 6.1.c del Reglamento General de Protección de Datos. En caso de obligación legal, requerimiento administrativo o judicial, determinados datos podrán tratarse o comunicarse a las autoridades competentes.

#### Consentimiento

Artículo 6.1.a del Reglamento General de Protección de Datos. Cuando sea necesario para tratamientos concretos no imprescindibles, se solicitará el consentimiento del usuario.

### 3.5 Comunicación a proveedores de inteligencia artificial

Para generar las respuestas, el contenido introducido por el usuario puede ser enviado a proveedores externos de inteligencia artificial, incluyendo:

- OpenAI / ChatGPT.
- Google / Gemini.
- Anthropic / Claude.

La finalidad de esta comunicación es exclusivamente procesar la consulta y generar la respuesta solicitada. La información enviada puede incluir el texto introducido por el usuario y los datos mínimos necesarios para prestar el servicio.

El usuario debe tener en cuenta que dichos proveedores pueden operar con infraestructuras internacionales y aplicar sus propias políticas, condiciones y medidas de seguridad.

### 3.6 Transferencias internacionales

El uso de proveedores tecnológicos internacionales puede implicar que determinados datos sean tratados fuera del Espacio Económico Europeo.

Cuando esto ocurra, se procurará que el tratamiento se realice conforme a mecanismos reconocidos por la normativa europea, tales como cláusulas contractuales tipo, decisiones de adecuación, medidas técnicas complementarias u otros instrumentos legalmente aplicables.

### 3.7 Conservación de los datos

Los datos se conservarán durante el tiempo necesario para cumplir las finalidades indicadas.

Con carácter orientativo:

- Los logs técnicos podrán conservarse durante el tiempo necesario para seguridad, auditoría y prevención de abusos.
- Las consultas y respuestas podrán conservarse mientras resulten necesarias para trazabilidad, mejora del servicio, resolución de incidencias o defensa frente a reclamaciones.
- Los datos anonimizados o agregados podrán conservarse durante periodos superiores cuando ya no permitan identificar directa o indirectamente al usuario.

El Titular podrá eliminar o anonimizar los datos cuando dejen de ser necesarios para la finalidad que justificó su tratamiento.

### 3.8 Derechos de los usuarios

El usuario puede ejercer los siguientes derechos:

- Derecho de acceso.
- Derecho de rectificación.
- Derecho de supresión.
- Derecho de oposición.
- Derecho a la limitación del tratamiento.
- Derecho a la portabilidad, cuando proceda.
- Derecho a retirar el consentimiento, cuando el tratamiento se base en el consentimiento.

Para ejercer estos derechos, el usuario puede enviar una solicitud a:

**jfloradmin@cibermedida.es**

La solicitud deberá indicar claramente el derecho que desea ejercer y permitir la identificación razonable del solicitante.

El usuario también puede presentar una reclamación ante la Agencia Española de Protección de Datos si considera que el tratamiento no se ajusta a la normativa aplicable.

### 3.9 Medidas de seguridad

El Titular aplicará medidas técnicas y organizativas razonables para proteger la información tratada, incluyendo, cuando proceda:

- Cifrado de comunicaciones mediante HTTPS.
- Control de acceso.
- Registro de eventos de seguridad.
- Limitación de accesos internos.
- Revisión de incidencias.
- Medidas contra abuso automatizado.
- Actualizaciones técnicas.
- Minimización de datos cuando sea posible.

Ningún sistema conectado a Internet puede garantizar una seguridad absoluta, pero se adoptarán medidas razonables y proporcionales al riesgo.

---

## 4. Política de cookies y tecnologías similares

### 4.1 Qué son las cookies

Las cookies son pequeños archivos o identificadores que se almacenan en el dispositivo del usuario o que permiten reconocer una sesión, mantener preferencias, facilitar el funcionamiento técnico o reforzar la seguridad.

### 4.2 Cookies utilizadas

La plataforma puede utilizar cookies o tecnologías similares de carácter técnico, necesarias para el funcionamiento del servicio, incluyendo:

- Cookies de sesión.
- Identificadores técnicos de aceptación de términos.
- Preferencias básicas.
- Cookies de seguridad.
- Elementos necesarios para recordar la aceptación de condiciones legales.

### 4.3 Cookies no utilizadas actualmente

Según la información disponible, la plataforma no utiliza actualmente herramientas adicionales de analítica, publicidad comportamental, seguimiento comercial o remarketing.

Si en el futuro se incorporan herramientas como Google Analytics, Cloudflare, Meta Pixel, Firebase, Supabase, Vercel Analytics u otras similares, esta política deberá actualizarse y, cuando proceda, solicitarse el consentimiento correspondiente.

### 4.4 Gestión de cookies

El usuario puede configurar, bloquear o eliminar cookies desde su navegador. No obstante, la desactivación de determinadas cookies técnicas puede afectar al funcionamiento correcto de la plataforma.

---

## 5. Información específica sobre inteligencia artificial

### 5.1 Funcionamiento general

La plataforma procesa las consultas del usuario mediante modelos de inteligencia artificial. Estos sistemas generan respuestas a partir de patrones, instrucciones, contexto y datos proporcionados por el usuario.

### 5.2 Posibles limitaciones

El usuario reconoce que los sistemas de IA pueden:

- Generar errores.
- Omitir información relevante.
- Interpretar incorrectamente una consulta.
- Producir respuestas desactualizadas.
- Presentar información con apariencia de certeza aunque no sea correcta.
- No comprender completamente el contexto real del usuario.

### 5.3 Verificación de respuestas

El usuario debe verificar las respuestas cuando vayan a utilizarse en contextos relevantes, especialmente en asuntos legales, sanitarios, económicos, laborales, administrativos, técnicos críticos o de seguridad.

### 5.4 Ausencia de decisiones automatizadas con efectos jurídicos

La plataforma no está destinada a adoptar decisiones automatizadas que produzcan efectos jurídicos sobre el usuario o que le afecten significativamente de forma similar.

Las respuestas son orientativas y requieren revisión humana antes de su uso en decisiones importantes.

---

## 6. Cláusula específica de aceptación

Al marcar la casilla de aceptación y continuar usando la plataforma, el usuario declara que:

- Ha leído los Términos de Uso y la Política de Privacidad.
- Comprende que la plataforma registra datos técnicos y de actividad.
- Comprende que las consultas y respuestas pueden almacenarse.
- Comprende que el contenido introducido puede enviarse a proveedores externos de inteligencia artificial.
- Se compromete a no introducir datos sensibles, confidenciales o de terceros sin autorización.
- Acepta utilizar el servicio bajo su responsabilidad y verificar las respuestas relevantes antes de utilizarlas.

---

## 7. Actualización de la documentación legal

El Titular podrá actualizar esta documentación para adaptarla a cambios técnicos, legales, organizativos o de funcionamiento de la plataforma.

Cuando se produzcan cambios relevantes, podrá solicitarse al usuario una nueva aceptación de los términos actualizados.
`;

  app.get("/api/terms", (_req, res) => {
    res.json({ version: TERMS_VERSION, date: TERMS_DATE, content: TERMS_CONTENT });
  });

  app.post("/api/accept-terms", (req, res) => {
    try {
      const { version, client, acceptedAt, source } = req.body;
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "desconocida";
      // País aproximado: algunos proxys/CDN lo añaden como cabecera. Si no existe, queda "desconocido".
      const country =
        (req.headers["cf-ipcountry"] as string) ||
        (req.headers["x-vercel-ip-country"] as string) ||
        (req.headers["x-country-code"] as string) ||
        "desconocido";

      const ua = (req.headers["user-agent"] as string) || "desconocido";

      const record = {
        version: version || TERMS_VERSION,
        acceptedAt: acceptedAt || new Date().toISOString(),
        source: source || "TermsGate",
        // Datos captados por el servidor (cabeceras)
        ip,
        country,
        userAgent: ua,
        acceptLanguageHeader: (req.headers["accept-language"] as string) || "",
        // Datos técnicos enviados por el navegador del cliente
        sessionId: client?.sessionId || "",
        timezone: client?.timezone || "",
        language: client?.language || "",
        screenResolution: client?.screenResolution || "",
        deviceType: client?.deviceType || "",
        browser: client?.browser || "",
        browserVersion: client?.browserVersion || "",
        os: client?.os || "",
      };
      const existing = fs.existsSync(TERMS_ACCEPTANCE_FILE) ? JSON.parse(fs.readFileSync(TERMS_ACCEPTANCE_FILE, "utf-8")) : [];
      existing.unshift(record);
      fs.writeFileSync(TERMS_ACCEPTANCE_FILE, JSON.stringify(existing.slice(0, 5000), null, 2));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "No se pudo registrar la aceptación", details: String(error) });
    }
  });

  app.get("/api/terms-acceptance-log", requireAuth, (_req, res) => {
    try {
      const existing = fs.existsSync(TERMS_ACCEPTANCE_FILE) ? JSON.parse(fs.readFileSync(TERMS_ACCEPTANCE_FILE, "utf-8")) : [];
      res.json({ count: existing.length, recent: existing.slice(0, 100) });
    } catch {
      res.json({ count: 0, recent: [] });
    }
  });

  app.get("/api/public-stats", (_req, res) => {
    try {
      const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      const autosaveData = fs.existsSync(AUTOSAVE_FILE) ? JSON.parse(fs.readFileSync(AUTOSAVE_FILE, "utf-8")) : [];
      const logData = fs.existsSync(PROMPT_LOG_FILE) ? JSON.parse(fs.readFileSync(PROMPT_LOG_FILE, "utf-8")) : [];
      res.json({
        autosaveCount: autosaveData.length,
        logCount: logData.length,
        tokens: db.stats?.totalTokens || 0,
        filesProcessed: db.stats?.filesProcessed || 0,
        promptsCount: db.prompts?.length || 0,
        recentLog: logData.slice(0, 10),
        recentAutosave: autosaveData.slice(0, 3),
      });
    } catch {
      res.json({ autosaveCount: 0, logCount: 0, tokens: 0, filesProcessed: 0, promptsCount: 0, recentLog: [], recentAutosave: [] });
    }
  });

  // ─── Autoguardado (lectura protegida, escritura desde servidor) ──────────
  app.get("/api/autosave", requireAuth, (_req, res) => {
    const data = JSON.parse(fs.readFileSync(AUTOSAVE_FILE, "utf-8"));
    res.json(data);
  });

  app.delete("/api/autosave", requireAuth, (_req, res) => {
    fs.writeFileSync(AUTOSAVE_FILE, JSON.stringify([], null, 2));
    res.json({ status: "ok" });
  });


  // ─── Configuración del motor de prompts ─────────────────────────────────
  app.get("/api/prompt-config", requireAuth, (_req, res) => {
    res.json(loadPromptConfig());
  });

  app.post("/api/prompt-config", requireAuth, (req, res) => {
    try {
      const { systemPrompt, temperature, maxTokens, language } = req.body;
      const updated = savePromptConfig({ systemPrompt, temperature, maxTokens, language });
      res.json({ status: "ok", config: updated });
    } catch (err) {
      res.status(500).json({ error: "Error guardando configuración", details: String(err) });
    }
  });

  app.post("/api/prompt-config/reset", requireAuth, (_req, res) => {
    try {
      if (fs.existsSync(PROMPT_CONFIG_FILE)) fs.unlinkSync(PROMPT_CONFIG_FILE);
      res.json({ status: "ok", config: DEFAULT_PROMPT_CONFIG });
    } catch (err) {
      res.status(500).json({ error: "Error restaurando configuración", details: String(err) });
    }
  });

  app.get("/api/prompt-config/default", requireAuth, (_req, res) => {
    res.json(DEFAULT_PROMPT_CONFIG);
  });

// ─── Historial de prompts COMPARTIDO (visible desde cualquier navegador) ───
  app.get("/api/prompt-history", (_req, res) => {
    try {
      const list = fs.existsSync(PROMPT_HISTORY_FILE)
        ? JSON.parse(fs.readFileSync(PROMPT_HISTORY_FILE, "utf-8"))
        : [];
      res.json({ history: list });
    } catch {
      res.json({ history: [] });
    }
  });

  app.post("/api/prompt-history", (req, res) => {
    try {
      const { content, label } = req.body || {};
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "content es obligatorio" });
      }
      const entry = {
        id: crypto.randomBytes(6).toString("hex"),
        content: content.slice(0, 8000),
        label: (label || "prompt").toString().slice(0, 60),
        at: Date.now(),
      };
      const list = fs.existsSync(PROMPT_HISTORY_FILE)
        ? JSON.parse(fs.readFileSync(PROMPT_HISTORY_FILE, "utf-8"))
        : [];
      list.unshift(entry);
      fs.writeFileSync(PROMPT_HISTORY_FILE, JSON.stringify(list.slice(0, 500), null, 2));
      res.json({ ok: true, entry });
    } catch (error) {
      res.status(500).json({ error: "No se pudo guardar", details: String(error) });
    }
  });

  app.delete("/api/prompt-history", requireAuth, (_req, res) => {
    try {
      fs.writeFileSync(PROMPT_HISTORY_FILE, JSON.stringify([], null, 2));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "No se pudo vaciar", details: String(error) });
    }
  });
  // ─── Generador de prompts ────────────────────────────────────────────
  app.post("/api/generate-prompt", aiLimiter, async (req, res) => {
    const { topic, audience, format, style, detail, provider, model, picard } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic is required" });

    try {
      let prompt: string;

      const cfg = loadPromptConfig();
      const lang = cfg.language === "en" ? "English" : "español de España";
      const promptType = req.body.promptType || "auto";
      const typeInstruction = promptType !== "auto"
        ? `\nAPLICA el tipo de prompt: ${promptType}`
        : "";

      if (picard) {
        prompt = `Genera un prompt profesional siguiendo el framework P.I.C.A.R.D. en ${lang}.${typeInstruction}

PERSONA (rol de la IA): ${picard.persona || "el más adecuado para la tarea"}
INSTRUCCIÓN (tarea principal): ${topic}
CONTEXTO (información de fondo): ${picard.contexto || "no especificado"}
AUDIENCIA (a quién va el resultado): ${audience || "adultos con nivel técnico básico"}
RESTRICCIONES (formato, longitud, límites): ${picard.restricciones || format || "sin restricciones específicas"}
DEMOSTRACIÓN (ejemplo de salida): ${picard.demostracion || "no especificada"}

Devuelve EXCLUSIVAMENTE el prompt final optimizado y listo para usar.`;
      } else {
        prompt = `Genera un prompt efectivo en ${lang} para la siguiente tarea.${typeInstruction}

TAREA: ${topic}
AUDIENCIA: ${audience || "adultos con nivel técnico básico"}
FORMATO DE SALIDA: ${format}
ESTILO: ${style}
NIVEL DE DETALLE: ${detail}

Devuelve SOLO el prompt final, sin explicaciones adicionales.`;
      }

      logPrompt(req, "generate-prompt", provider || "gemini", model, topic);
      const engineConfig = loadPromptConfig();

      const responseText = await generateAIContent({
        provider: provider || "gemini",
        model,
        prompt,
        systemPrompt: engineConfig.systemPrompt,
        temperature: engineConfig.temperature,
        maxTokens: engineConfig.maxTokens,
      });
      res.json({ prompt: responseText });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Error en la generación de IA", details: String(error) });
    }
  });

  // ─── Herramientas del Lab: evaluar / refinar / ejecutar / explicar ───
  app.post("/api/prompt-tools", aiLimiter, async (req, res) => {
    const { action, prompt: userPrompt, provider, model } = req.body;
    if (!action || !userPrompt) return res.status(400).json({ error: "action y prompt son obligatorios" });

    const systemPrompts: Record<string, string> = {
      evaluate: `Eres un evaluador experto de prompts. Analiza el prompt que recibas y devuelve EXCLUSIVAMENTE un JSON válido (sin markdown, sin texto adicional) con esta estructura:
{"claridad": <1-10>, "especificidad": <1-10>, "contexto": <1-10>, "global": <1-10>, "fortalezas": ["..."], "mejoras": ["..."]}
Las sugerencias de mejora deben ser concretas y accionables, en español.`,
      refine: `Eres un ingeniero de prompts experto. Reescribe y mejora el prompt que recibas conservando exactamente su intención original. Hazlo más claro, específico y estructurado. Devuelve EXCLUSIVAMENTE el prompt mejorado, sin explicaciones.`,
      run: `Eres un asistente de IA útil y preciso. Responde al prompt del usuario de forma directa y profesional, en el idioma del prompt.`,
      explain: `Eres un profesor experto en ingeniería de prompts. Analiza el prompt que recibas con fines didácticos y devuelve EXCLUSIVAMENTE un JSON válido (sin markdown) con esta estructura:
{"tecnicas": [{"nombre": "...", "descripcion": "...", "donde": "fragmento del prompt donde se aplica"}], "porQueFunciona": "explicación pedagógica en español de 2-4 frases", "consejoDocente": "un consejo para enseñar esta técnica en clase"}
Técnicas posibles: asignación de rol, few-shot, chain-of-thought, delimitadores, formato de salida, restricciones, contexto, audiencia definida, etc.`,
    };

    const systemPrompt = systemPrompts[action];
    if (!systemPrompt) return res.status(400).json({ error: "Acción no válida" });

    try {
      logPrompt(req, `prompt-tools:${action}`, provider || "gemini", model, userPrompt);

      const responseText = await generateAIContent({
        provider: provider || "gemini",
        model,
        prompt: userPrompt,
        systemPrompt,
        maxTokens: 3000,
      });
      res.json({ result: responseText });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Error en la herramienta de IA", details: String(error) });
    }
  });

  // ─── Chat de automatización ──────────────────────────────────────────
  // ─── Constructor de Skills ──────────────────────────────────────────────
  const SKILL_SYSTEM_PROMPTS: Record<string, string> = {
    documentos: "Especialízate en skills que generan documentos (DOCX, PPTX, PDF, XLSX). Incluye instrucciones sobre estructura, formato y uso de librerías como docx o pptxgenjs.",
    creativo: "Especialízate en skills creativas y de diseño (arte, plantillas visuales, landing pages, HTML/CSS).",
    desarrollo: "Especialízate en skills técnicas de desarrollo (código, testing, scripts, automatización, integración).",
    empresa: "Especialízate en skills de empresa y comunicación (propuestas, emails, informes, documentos comerciales).",
    personal: "Especialízate en skills de flujo de trabajo personal que automatizan tareas repetidas o aplican convenciones propias.",
    marca: "Especialízate en skills que aplican la identidad de marca Cibermedida (colores navy/cyan, tipografía Arial, formato A4, diseño profesional).",
  };

  app.post("/api/skill-builder", aiLimiter, async (req, res) => {
    const { messages, text, provider, model, skillType } = req.body;
    if (!text) return res.status(400).json({ error: "text es obligatorio" });

    const typeContext = SKILL_SYSTEM_PROMPTS[skillType] || "";
    const systemPrompt = `Eres un experto constructor de Agent Skills para Claude (Anthropic), integrado en PromptCore de Cibermedida.

${typeContext}

Tu tarea es ayudar al usuario a diseñar una skill y generar el contenido completo de un archivo SKILL.md siguiendo la estructura oficial de Anthropic:

1. FRONTMATTER YAML (entre ---):
   - name: nombre-en-minusculas-con-guiones
   - description: descripción clara que incluya QUÉ hace la skill y CUÁNDO debe usarla Claude (los triggers de activación). Esto es lo MÁS importante: determina cuándo Claude invoca la skill. Incluye palabras y frases concretas que el usuario diría.

2. CUERPO (markdown tras el frontmatter):
   - Título de la skill
   - Sección de cuándo usarla (When to use)
   - Instrucciones paso a paso claras y repetibles
   - Ejemplos concretos
   - Recursos o consideraciones si aplica

REGLAS:
- Cuando el usuario te dé suficiente información, genera el SKILL.md COMPLETO dentro de un bloque de código markdown (\`\`\`markdown ... \`\`\`).
- La description debe ser específica y rica en triggers para que Claude active la skill correctamente.
- Usa español salvo que se pida otro idioma.
- Si falta información clave, haz UNA pregunta breve antes de generar.
- Sé conciso y práctico.`;

    try {
      logPrompt(req, "skill-builder", provider || "gemini", model, text);
      const cfg = loadPromptConfig();
      const responseText = await chatAI({
        provider: provider || "gemini",
        model,
        messages: messages || [],
        newMessage: text,
        systemPrompt,
        temperature: cfg.temperature,
      });
      res.json({ text: responseText });
    } catch (error) {
      console.error("Skill builder error:", error);
      res.status(500).json({ error: "Error en el constructor de skills", details: String(error) });
    }
  });

  // Empaquetar una skill como .zip con estructura de carpeta
  // ─── Skill Creator: generar SKILL.md estructurado ───────────────────────
  app.post("/api/skill-generate", aiLimiter, async (req, res) => {
    const { intent, skillType, provider, model } = req.body;
    if (!intent) return res.status(400).json({ error: "intent es obligatorio" });

    const typeContext = SKILL_SYSTEM_PROMPTS[skillType] || "";
    const systemPrompt = `Eres el Skill Creator de Anthropic, integrado en PromptCore de Cibermedida. Generas archivos SKILL.md siguiendo la metodología oficial de Anthropic.

${typeContext}

ESTRUCTURA OBLIGATORIA del SKILL.md:

1. FRONTMATTER YAML (entre ---):
   - name: nombre-en-minusculas-con-guiones (identificador único)
   - description: el campo MÁS importante. Determina cuándo Claude activa la skill. Debe incluir QUÉ hace Y CUÁNDO usarla, con frases y contextos concretos. Hazla "pushy": en vez de "Crea informes", escribe "Crea informes. Usa esta skill SIEMPRE que el usuario mencione informes, reportes, resúmenes de datos o quiera presentar resultados, aunque no diga explícitamente 'informe'." Claude tiende a infra-activar skills, así que la descripción debe empujar hacia el uso.

2. CUERPO en markdown tras el frontmatter:
   - Título de la skill
   - Breve explicación de qué hace y por qué
   - Sección de instrucciones en forma IMPERATIVA, explicando el PORQUÉ de cada paso (no uses MUST/NEVER en mayúsculas rígidas; explica el razonamiento)
   - Ejemplos concretos en formato Input/Output cuando aplique
   - Si necesita recursos (scripts/, references/, assets/), indícalos con un comentario sobre qué irían

REGLAS:
- Mantén el cuerpo bajo 500 líneas (progressive disclosure)
- Usa español salvo que se pida otro idioma
- Devuelve EXCLUSIVAMENTE el contenido del SKILL.md dentro de un bloque de codigo markdown (triple backtick markdown)
- No añadas explicaciones fuera del bloque`;

    try {
      logPrompt(req, "skill-generate", provider || "gemini", model, intent);
      const cfg = loadPromptConfig();
      const responseText = await generateAIContent({
        provider: provider || "gemini",
        model,
        prompt: `Genera el SKILL.md completo a partir de esta especificación:\n\n${intent}`,
        systemPrompt,
        temperature: cfg.temperature,
        maxTokens: 4000,
      });
      res.json({ skill: responseText });
    } catch (error) {
      res.status(500).json({ error: "Error generando el SKILL.md", details: String(error) });
    }
  });

  // ─── Skill Creator: optimizar la descripción (triggering) ───────────────
  app.post("/api/skill-optimize-description", aiLimiter, async (req, res) => {
    const { skillContent, provider, model } = req.body;
    if (!skillContent) return res.status(400).json({ error: "skillContent es obligatorio" });

    const systemPrompt = `Eres un experto en optimización de descripciones de skills para Claude. La descripción del frontmatter es lo que determina si Claude activa la skill.

Analiza el SKILL.md recibido y devuelve EXCLUSIVAMENTE un JSON válido (sin markdown) con esta estructura:
{
  "descripcionActual": "la description actual extraída del frontmatter",
  "descripcionOptimizada": "una versión mejorada y 'pushy' que incluya qué hace Y cuándo usarla, con frases concretas que el usuario diría",
  "mejoras": ["lista de qué se mejoró y por qué"],
  "triggersPositivos": ["5-6 frases reales que SÍ deberían activar la skill"],
  "triggersNegativos": ["3-4 frases parecidas que NO deberían activarla (near-misses)"]
}

La descripción optimizada debe combatir la infra-activación: ser específica, rica en contextos y empujar hacia el uso.`;

    try {
      const cfg = loadPromptConfig();
      const responseText = await generateAIContent({
        provider: provider || "gemini",
        model,
        prompt: skillContent,
        systemPrompt,
        temperature: 0.3,
        maxTokens: 2000,
      });
      res.json({ result: responseText });
    } catch (error) {
      res.status(500).json({ error: "Error optimizando la descripción", details: String(error) });
    }
  });

  // ─── Skill Creator: generar casos de prueba ─────────────────────────────
  app.post("/api/skill-tests", aiLimiter, async (req, res) => {
    const { skillContent, provider, model } = req.body;
    if (!skillContent) return res.status(400).json({ error: "skillContent es obligatorio" });

    const systemPrompt = `Eres un experto en validación de skills. Genera casos de prueba realistas para verificar que una skill funciona.

Devuelve EXCLUSIVAMENTE un JSON válido (sin markdown):
{
  "casos": [
    {"id": 1, "prompt": "prompt realista que un usuario real escribiría, con detalles concretos (nombres de archivo, contexto, datos)", "resultadoEsperado": "qué debería producir la skill"}
  ]
}

Genera 3 casos. Los prompts deben ser concretos y realistas (rutas de archivo, nombres de empresa, contexto del trabajo), no abstractos. Mezcla registros: alguno formal, alguno casual.`;

    try {
      const cfg = loadPromptConfig();
      const responseText = await generateAIContent({
        provider: provider || "gemini",
        model,
        prompt: skillContent,
        systemPrompt,
        temperature: 0.5,
        maxTokens: 2000,
      });
      res.json({ result: responseText });
    } catch (error) {
      res.status(500).json({ error: "Error generando casos de prueba", details: String(error) });
    }
  });

  // ─── Skill Creator: ejecutar y evaluar un caso de prueba ──────────────
  app.post("/api/skill-run-test", aiLimiter, async (req, res) => {
    const { skillContent, testPrompt, expectedResult, provider, model } = req.body;
    if (!skillContent || !testPrompt) return res.status(400).json({ error: "skillContent y testPrompt son obligatorios" });

    try {
      const cfg = loadPromptConfig();

      // Paso 1: Ejecutar el test — usar la skill como system prompt
      const response = await generateAIContent({
        provider: provider || "gemini",
        model,
        prompt: testPrompt,
        systemPrompt: skillContent,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
      });

      // Paso 2: Evaluar el resultado comparando con lo esperado
      const evalPrompt = `Evalúa la calidad de esta respuesta generada por una IA que tenía cargada una skill.

PROMPT DEL USUARIO:
"""${testPrompt}"""

RESULTADO ESPERADO:
"""${expectedResult || "No especificado"}"""

RESPUESTA OBTENIDA:
"""${response}"""

Devuelve EXCLUSIVAMENTE un JSON válido (sin markdown ni backticks) con esta estructura:
{
  "puntuacion": <número del 1 al 5>,
  "veredicto": "<EXCELENTE|BUENO|ACEPTABLE|MEJORABLE|FALLO>",
  "cumple": <true si la respuesta cumple razonablemente lo esperado, false si no>,
  "observaciones": "<1-2 frases con qué hizo bien y qué podría mejorar>",
  "sugerenciaMejora": "<1 frase de cómo mejorar la skill si la puntuación es < 4, o null si >= 4>"
}

Criterios de puntuación:
5 = Respuesta perfecta, cumple completamente lo esperado
4 = Muy buena, cumple con detalles menores mejorables  
3 = Aceptable, cumple parcialmente
2 = Mejorable, falta contenido importante
1 = Fallo, no cumple lo esperado`;

      const evalResponse = await generateAIContent({
        provider: provider || "gemini",
        model,
        prompt: evalPrompt,
        temperature: 0.2,
        maxTokens: 500,
      });

      res.json({ response, evaluation: evalResponse });
    } catch (error) {
      res.status(500).json({ error: "Error ejecutando el test", details: String(error) });
    }
  });

  // ─── Validador y corrector de SKILL.md (requisitos de skills.sh / Claude) ──
  function validateSkillMd(content: string) {
    const errors: string[] = [];
    const warnings: string[] = [];
    let fixedContent = String(content || "").replace(/\r\n/g, "\n").trim();

    // 1. Debe empezar con frontmatter YAML delimitado por ---
    const fmMatch = fixedContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!fmMatch) {
      errors.push("Falta el frontmatter YAML (debe empezar con --- y cerrar con --- antes del contenido).");
      // Intento de auto-arreglo: si hay name/description sueltos, los envolvemos
      const looseName = fixedContent.match(/^name:\s*(.+)$/m);
      const looseDesc = fixedContent.match(/^description:\s*(.+)$/m);
      if (looseName || looseDesc) {
        const name = looseName ? looseName[1].trim() : "skill-sin-nombre";
        const description = looseDesc ? looseDesc[1].trim() : "Sin descripción";
        const rest = fixedContent.replace(/^name:.*$/m, "").replace(/^description:.*$/m, "").trim();
        fixedContent = `---\nname: ${name}\ndescription: ${description}\n---\n\n${rest}`;
        warnings.push("Se generó automáticamente el bloque frontmatter a partir de name/description sueltos.");
      } else {
        // No hay nada reconocible: envolver todo el contenido bajo un frontmatter genérico
        fixedContent = `---\nname: skill-sin-nombre\ndescription: Skill generada automáticamente. Edita esta descripción para indicar qué hace y cuándo debe usarse.\n---\n\n${fixedContent}`;
        warnings.push("No se encontró name/description; se añadió un frontmatter genérico que debes editar.");
      }
    }

    // Reevaluar tras el posible auto-arreglo
    const fm2 = fixedContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    let name = "";
    let description = "";
    if (fm2) {
      const yamlBlock = fm2[1];
      const nameMatch = yamlBlock.match(/^name:\s*(.+)$/m);
      const descMatch = yamlBlock.match(/^description:\s*([\s\S]+?)(?=\n[a-zA-Z_-]+:|$)/m);
      name = nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, "") : "";
      description = descMatch ? descMatch[1].trim().replace(/^["']|["']$/g, "") : "";

      if (!name) errors.push("Falta el campo 'name' en el frontmatter.");
      if (!description) errors.push("Falta el campo 'description' en el frontmatter.");

      // 2. name debe ser kebab-case válido
      if (name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
        const fixedName = name.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim().replace(/\s+/g, "-").replace(/-+/g, "-");
        fixedContent = fixedContent.replace(/^name:\s*.+$/m, `name: ${fixedName}`);
        warnings.push(`El nombre "${name}" no era válido (debe ser kebab-case: minúsculas, números y guiones). Se corrigió a "${fixedName}".`);
        name = fixedName;
      }

      // 3. description no debe ser excesivamente corta
      if (description && description.length < 15) {
        warnings.push("La descripción es muy corta. Para que Claude la active correctamente, incluye QUÉ hace y CUÁNDO usarla.");
      }

      // 4. Debe haber contenido tras el frontmatter
      const body = fm2[2] ? fm2[2].trim() : "";
      if (!body) {
        errors.push("No hay contenido tras el frontmatter (el cuerpo de instrucciones está vacío).");
      }
    }

    // 5. Longitud razonable (progressive disclosure, recomendado <500 líneas)
    const lineCount = fixedContent.split("\n").length;
    if (lineCount > 500) {
      warnings.push(`El archivo tiene ${lineCount} líneas. Anthropic recomienda mantener el SKILL.md por debajo de 500 líneas; mueve detalle extenso a archivos de referencia.`);
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings, fixedContent, name, description };
  }

  app.post("/api/validate-skill-md", (req, res) => {
    const { content } = req.body;
    if (typeof content !== "string") return res.status(400).json({ error: "content es obligatorio" });
    const result = validateSkillMd(content);
    res.json(result);
  });

  // ─── Integración con skills.sh vía mastra-ai/skills-api (self-hosted) ──
  // Servicio interno desplegado en el VPS (PM2 "skills-api", puerto 3456,
  // no expuesto a internet). Sirve un índice propio de ~34.000 skills y
  // lee el contenido de cada SKILL.md directamente desde GitHub.
  const SKILLS_API_BASE = process.env.SKILLS_API_URL || "http://localhost:3456/api";

  async function fetchSkillsApi(path: string) {
    const r = await fetch(`${SKILLS_API_BASE}${path}`);
    if (!r.ok) throw new Error(`skills-api respondió ${r.status}`);
    return await r.json();
  }

  app.get("/api/skillsh-leaderboard", async (req, res) => {
    try {
      const perPage = parseInt((req.query.per_page as string) || "20", 10);
      const data = await fetchSkillsApi(`/skills/top?limit=${perPage}`);
      const items = (data.skills || []).map((s: any) => ({
        slug: s.skillId, source: s.source, name: s.displayName || s.name,
        installs: String(s.installs), url: `https://skills.sh/${s.source}/${s.skillId}`,
      }));
      res.json({ data: items, source: "skills-api" });
    } catch (error) {
      res.status(502).json({ error: "skills-api no accesible en este momento", details: String(error) });
    }
  });

  app.get("/api/skillsh-search", async (req, res) => {
    try {
      const q = (req.query.q as string) || "";
      if (q.length < 2) return res.status(400).json({ error: "q debe tener al menos 2 caracteres" });
      const data = await fetchSkillsApi(`/skills?query=${encodeURIComponent(q)}&pageSize=30`);
      const items = (data.skills || []).map((s: any) => ({
        slug: s.skillId, source: s.source, name: s.displayName || s.name,
        installs: String(s.installs), url: `https://skills.sh/${s.source}/${s.skillId}`,
      }));
      res.json({ data: items, query: q, total: data.total, source: "skills-api" });
    } catch (error) {
      res.status(502).json({ error: "skills-api no accesible en este momento", details: String(error) });
    }
  });

  app.get("/api/skillsh-curated", async (req, res) => {
    try {
      // El registro propio no distingue "oficiales"; usamos top por installs como aproximación
      const data = await fetchSkillsApi(`/skills/top?limit=30`);
      const items = (data.skills || []).map((s: any) => ({
        slug: s.skillId, source: s.source, name: s.displayName || s.name,
        installs: String(s.installs), url: `https://skills.sh/${s.source}/${s.skillId}`,
      }));
      res.json({ data: items, source: "skills-api" });
    } catch (error) {
      res.status(502).json({ error: "skills-api no accesible en este momento", details: String(error) });
    }
  });

  app.get("/api/skillsh-detail/*", async (req, res) => {
    try {
      const idPath = (req.params as any)[0] as string; // owner/repo/skillId
      const parts = idPath.split("/");
      if (parts.length < 3) return res.status(400).json({ error: "Ruta inválida, se espera owner/repo/skillId" });
      const [owner, repo, skillId] = [parts[0], parts[1], parts.slice(2).join("/")];

      const content = await fetchSkillsApi(`/skills/${owner}/${repo}/${skillId}/content`);
      if (!content || !content.instructions) {
        return res.status(404).json({ error: "No se pudo obtener el contenido de esta skill", id: idPath });
      }

      res.json({
        id: idPath,
        installCommand: `npx skills add https://github.com/${owner}/${repo} --skill ${skillId}`,
        installs: null,
        stars: null,
        repo: `${owner}/${repo}`,
        skillMd: content.raw || content.instructions,
        audits: [],
        url: `https://skills.sh/${idPath}`,
        source: "skills-api",
      });
    } catch (error) {
      res.status(502).json({ error: "No se pudo obtener el detalle desde skills-api", details: String(error) });
    }
  });

  app.get("/api/skillsh-audit/*", async (req, res) => {
    // El registro propio (mastra-ai/skills-api) no incluye auditorías de seguridad.
    res.status(404).json({ error: "Auditorías no disponibles a través de este servicio. Consulta skills.sh directamente." });
  });

  // Estado y refresco manual del catálogo de skills-api (admin)
  app.get("/api/skillsh-status", async (req, res) => {
    try {
      const data = await fetchSkillsApi(`/skills/stats`);
      res.json({ ...data, source: "skills-api" });
    } catch (error) {
      res.status(502).json({ error: "skills-api no accesible en este momento", details: String(error) });
    }
  });

  app.post("/api/skillsh-refresh", requireAuth, async (req, res) => {
    try {
      const r = await fetch(`${SKILLS_API_BASE}/admin/refresh`, { method: "POST" });
      if (!r.ok) throw new Error(`skills-api respondió ${r.status}`);
      const data = await r.json();
      res.json({ ok: true, ...data });
    } catch (error) {
      res.status(502).json({ error: "No se pudo lanzar el refresco", details: String(error) });
    }
  });


  // ─── Constructor de JSON: generación a partir de texto natural ─────────
  app.post("/api/json-generate", aiLimiter, async (req, res) => {
    const { description, provider, model } = req.body;
    if (!description) return res.status(400).json({ error: "description es obligatorio" });

    const systemPrompt = `Eres un generador de estructuras JSON. A partir de la descripción del usuario, genera EXCLUSIVAMENTE un JSON válido que represente lo solicitado.

REGLAS:
- Devuelve SOLO el JSON, sin texto adicional, sin explicaciones, sin backticks ni bloques de código markdown.
- Si el usuario no especifica valores concretos, usa valores de ejemplo razonables y realistas.
- Usa nombres de claves en minúsculas, en inglés o español según el contexto de la petición, con snake_case si hay varias palabras.
- El JSON debe ser válido y estar correctamente formateado con indentación de 2 espacios.`;

    try {
      const responseText = await generateAIContent({
        provider: provider || "gemini",
        model,
        prompt: description,
        systemPrompt,
        temperature: 0.4,
        maxTokens: 2048,
      });
      // Limpiar posibles backticks de markdown que la IA pueda añadir
      const cleaned = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      let isValid = true;
      try { JSON.parse(cleaned); } catch { isValid = false; }
      res.json({ json: cleaned, isValid });
    } catch (error) {
      console.error("JSON generate error:", error);
      res.status(500).json({ error: "Error generando el JSON", details: String(error) });
    }
  });

  // ─── Constructor de JSON: extracción estructurada desde una URL ────────
  app.post("/api/json-extract-url", aiLimiter, async (req, res) => {
    const { url, instruction, provider, model } = req.body;
    if (!url) return res.status(400).json({ error: "url es obligatoria" });

    let parsedUrl: URL;
    try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: "URL no válida" }); }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: "Solo se admiten URLs http o https" });
    }

    try {
      const pageRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CibermedidaBot/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!pageRes.ok) {
        return res.status(502).json({ error: `La página respondió con estado ${pageRes.status}` });
      }
      const html = await pageRes.text();

      // Limpiar HTML a texto legible, descartando scripts/estilos/navegación
      const $ = cheerio.load(html);
      $("script, style, noscript, svg, nav, footer").remove();
      const title = $("title").text().trim();
      let text = $("body").text().replace(/\s+/g, " ").trim();
      // Límite de tamaño para evitar prompts excesivos o timeouts del modelo
      const MAX_CHARS = 15000;
      if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + " […contenido truncado…]";

      const userInstruction = instruction?.trim()
        ? instruction.trim()
        : "Extrae la estructura general de la página: títulos principales, enlaces relevantes y cualquier dato tabular u organizado que encuentres.";

      const systemPrompt = `Eres un extractor de datos estructurados. A partir del contenido de texto de una página web, genera EXCLUSIVAMENTE un JSON válido que cumpla la instrucción del usuario.

REGLAS:
- Devuelve SOLO el JSON, sin texto adicional, sin explicaciones, sin backticks.
- Si no encuentras algún dato pedido, omítelo o usa null, no inventes información que no esté en el texto proporcionado.
- Usa nombres de claves en snake_case.
- JSON válido con indentación de 2 espacios.`;

      const prompt = `Título de la página: ${title}\n\nInstrucción: ${userInstruction}\n\nContenido de la página:\n"""${text}"""`;

      const responseText = await generateAIContent({
        provider: provider || "gemini",
        model,
        prompt,
        systemPrompt,
        temperature: 0.3,
        maxTokens: 2048,
      });
      const cleaned = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      let isValid = true;
      try { JSON.parse(cleaned); } catch { isValid = false; }
      res.json({ json: cleaned, isValid, sourceTitle: title, sourceUrl: url });
    } catch (error: any) {
      const isTimeout = error.name === "TimeoutError" || error.name === "AbortError";
      res.status(502).json({
        error: isTimeout ? "La página tardó demasiado en responder" : "No se pudo acceder o procesar la URL",
        details: String(error),
      });
    }
  });

  app.post("/api/skill-package", async (req, res) => {
    const { name, content } = req.body;
    if (!name || !content) return res.status(400).json({ error: "name y content son obligatorios" });

    // Validar y auto-corregir el SKILL.md antes de empaquetar — garantiza
    // que el .zip cumple los requisitos de skills.sh / Claude (frontmatter + name + description)
    const validation = validateSkillMd(String(content));
    const finalContent = validation.fixedContent;
    const folderNameSource = validation.name || String(name);

    const folderName = folderNameSource.toLowerCase()
      .replace(/[^a-z0-9-\s]/g, "")
      .trim().replace(/\s+/g, "-")
      .slice(0, 60) || "skill";

    try {
      const zip = new JSZip();
      zip.file(`${folderName}/SKILL.md`, finalContent);

      // Subcarpetas opcionales con archivos extra
      const extras = req.body.extras; // { "scripts/build.py": "...", "references/guide.md": "..." }
      if (extras && typeof extras === "object") {
        for (const [relPath, fileContent] of Object.entries(extras)) {
          const safePath = String(relPath).replace(/\.\./g, "").replace(/^\/+/, "");
          zip.file(`${folderName}/${safePath}`, String(fileContent));
        }
      }
      // Carpetas vacías de estructura si se piden
      if (req.body.includeFolders) {
        zip.folder(`${folderName}/scripts`);
        zip.folder(`${folderName}/references`);
        zip.folder(`${folderName}/assets`);
      }

      const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${folderName}.zip"`);
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: "Error al empaquetar", details: String(err) });
    }
  });

  app.post("/api/automation-chat", aiLimiter, async (req, res) => {
    const { messages, text, provider, model } = req.body;
    if (!messages || !text) return res.status(400).json({ error: "Messages and text are required" });

    const systemPrompt = `Eres un Arquitecto de Automatización experto de CyberMedida. Tu objetivo es ayudar al usuario a automatizar sus procesos y conexiones de datos.

ESTRATEGIA:
1. Haz preguntas inteligentes y breves, de una en una, para entender el flujo de trabajo.
2. Pregunta específicamente por:
   - Herramientas involucradas (Google Sheets, Notion, Stripe, etc).
   - Evento disparador (Trigger).
   - Acción principal deseada.
   - Reglas o condiciones críticas.
   - Formato de salida y necesidades de extracción.
3. SÉ PROACTIVO: Sugiere opciones que el usuario quizás no ha considerado.
4. FORMATO: Usa Markdown para que la respuesta sea legible.
5. Al final, cuando tengas suficiente información, propón una "Receta de Automatización" detallada con pasos técnicos.`;

    try {
      logPrompt(req, "automation-chat", provider || "gemini", model, text);

      const responseText = await chatAI({
        provider: provider || "gemini",
        model,
        messages,
        newMessage: text,
        systemPrompt,
      });
      res.json({ text: responseText });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Error de IA", details: String(error) });
    }
  });

  // ─── Transformación de Markdown a código ─────────────────────────────
  app.post("/api/transform", aiLimiter, async (req, res) => {
    const { markdown, language, provider, model } = req.body;
    if (!markdown || !language) return res.status(400).json({ error: "Markdown and language are required" });

    try {
      const prompt = `Actúa como un Ingeniero de Software experto especializado en ${language}.
Transforma el siguiente contenido Markdown en un script de ${language} optimizado, profesional y autodocumentado.
Si el contenido describe un proceso, automatízalo. Si son datos, crea estructuras de datos eficientes.
Incluye manejo de errores y comentarios detallados en español.

IMPORTANTE: Devuelve EXCLUSIVAMENTE el código fuente, sin explicaciones ni bloques markdown.

CONTENIDO A TRANSFORMAR:
${markdown}`;

      logPrompt(req, "transform", provider || "gemini", model, `[${language}] ${markdown.slice(0, 300)}`);

      const responseText = await generateAIContent({
        provider: provider || "gemini",
        model: model || (provider === "openai" ? "gpt-4o-mini" : "gemini-2.0-flash"),
        prompt,
      });

      const code = responseText.replace(/```[a-z]*\n?|```/g, "").trim();
      res.json({ code });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Error en la generación de IA", details: String(error) });
    }
  });

  // ─── Conversión de archivos ──────────────────────────────────────────
  app.post("/api/convert", (req, res, next) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        const msg = err.code === "LIMIT_FILE_SIZE" ? "El archivo supera el límite de 10 MB" : err.message;
        return res.status(400).json({ error: msg });
      }
      next();
    });
  }, async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = req.file.path;
    const extension = path.extname(req.file.originalname).toLowerCase();

    try {
      let markdown = "";

      if (extension === ".pdf") {
        const { PDFParse } = await import("pdf-parse");
        const dataBuffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: dataBuffer });
        try {
          const result = await parser.getText();
          markdown = `# Documento PDF: ${req.file.originalname}\n\n${result.text}`;
        } finally {
          await parser.destroy();
        }
      } else if (extension === ".docx") {
        const mammoth: any = await import("mammoth");
        const extract = mammoth.default?.extractRawText || mammoth.extractRawText;
        const result = await extract({ path: filePath });
        markdown = `# Documento Word: ${req.file.originalname}\n\n${result.value}`;
      } else {
        markdown = fs.readFileSync(filePath, "utf-8");
      }

      const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      db.stats.filesProcessed += 1;
      db.stats.totalSavings += 0.75;
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

      res.json({ markdown, filename: req.file.originalname.replace(/\.[^/.]+$/, "") + ".md" });
    } catch (error) {
      console.error("Conversion error:", error);
      res.status(500).json({
        error: "Error en el motor de conversión MarkItDown",
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  // ─── Validar configuración de claves DEL SERVIDOR ────────────────────
  app.post("/api/validate-key", aiLimiter, async (req, res) => {
    const { provider } = req.body || {};
    try {
      if (provider === "openai") {
        const openai = getOpenAI();
        await openai.models.list();
      } else if (provider === "claude") {
        const anthropic = getAnthropic();
        await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: "hi" }],
        });
      } else {
        const ai = getGenAI();
        const m = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
        await m.generateContent("Di hola");
      }
      res.json({ valid: true });
    } catch (error) {
      res.json({ valid: false, error: String(error) });
    }
  });

  // ─── Vite / Estáticos ────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
