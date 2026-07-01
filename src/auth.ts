import axios from "axios";
import { getClientMeta } from "./clientMeta";

// Endpoints que registran actividad y a los que conviene adjuntar metadatos del cliente
const LOGGED_ENDPOINTS = ["/api/generate-prompt", "/api/prompt-tools", "/api/transform", "/api/json-generate", "/api/json-extract-url"];

// Gestión del token de sesión de administración (expira a las 24h en servidor)
const TOKEN_KEY = "ADMIN_TOKEN";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function isUnlocked(): boolean {
  return Boolean(getToken());
}

export async function login(password: string): Promise<boolean> {
  const res = await axios.post("/api/auth", { password });
  if (res.data?.token) {
    setToken(res.data.token);
    return true;
  }
  return false;
}

// Interceptor global: añade Authorization a todas las peticiones si hay token
let installed = false;
export function installAuthInterceptor() {
  if (installed) return;
  installed = true;
  axios.interceptors.request.use((config) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    // Adjuntar metadatos del cliente a las peticiones POST que registran actividad
    try {
      const url = config.url || "";
      if (config.method?.toLowerCase() === "post" && LOGGED_ENDPOINTS.some((e) => url.includes(e))) {
        if (config.data && typeof config.data === "object" && !(config.data instanceof FormData)) {
          config.data = { ...config.data, __clientMeta: getClientMeta() };
        }
      }
    } catch { /* no bloquear la petición por un fallo al adjuntar metadatos */ }
    return config;
  });
  // Si el servidor devuelve 401, limpiamos el token caducado
  axios.interceptors.response.use(
    (r) => r,
    (error) => {
      if (error?.response?.status === 401) clearToken();
      return Promise.reject(error);
    }
  );
}
