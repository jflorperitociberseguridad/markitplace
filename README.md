<div align="center">

# 🧪 MarkItPlace · PromptCore

**Laboratorio de ingeniería de prompts e inteligencia artificial aplicada**

Desarrollado por **Cibermedida** con fines formativos y profesionales.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

🌐 [markitplace.cibermedida.es](https://markitplace.cibermedida.es) · 🏫 Proyecto de docencia

</div>

---

## 📖 Descripción

MarkItPlace (marca interna *PromptCore*) es una aplicación web full-stack orientada a la enseñanza y práctica de la ingeniería de prompts. Combina un panel de control con métricas en tiempo real, un laboratorio de prompts avanzado, herramientas de análisis asistido por IA y varios módulos de productividad, todo bajo una misma interfaz.

El proyecto sirve como material de apoyo del curso *Inteligencia artificial aplicada en el ámbito profesional*, pero funciona como una herramienta autónoma y completa.

---

## ✨ Características principales

### 🔬 Laboratorio de Prompts Avanzado

- ⚙️ Generación de prompts con parámetros configurables (público, formato, estilo, nivel de detalle).
- 🧩 **Framework C.R.E.F.O.**: constructor guiado por bloques (Contexto, Rol, Específicos, Formato, Objetivo).
- 📚 **Guía de 18 técnicas de prompt** agrupadas por familias (fundamentos, razonamiento, tareas concretas, avanzado), con explicación, ejemplos, ventajas, limitaciones y consejos.
- 🛠️ **Herramientas de análisis sobre el prompt**:
  - 📊 **Evaluar** — puntuaciones de calidad, fortalezas y áreas de mejora.
  - ✏️ **Mejorar** — versión refinada del prompt.
  - ▶️ **Ejecutar** — respuesta real de la IA.
  - 🎓 **Explicar** — técnicas detectadas y consejo didáctico.
- 🔀 Plantillas por sector, comparador de variantes A/B, comparación entre modelos, estimación de tokens y coste, exportación a Word y PDF, e historial de prompts compartido.

### 🧰 Otros módulos

- 📝 **MarkDown Pro** — conversión de documentos (PDF, DOCX, TXT, CSV) a Markdown y transformación de Markdown a código.
- 🔧 **JSON Builder** — construcción visual de JSON, generación por IA, extracción estructurada desde URLs, validación y formateo.
- 🧱 **Constructor de Skills** — asistente para crear *Agent Skills* siguiendo la metodología de Anthropic, con validación y empaquetado.
- 🤖 **Automatizaciones** — chat con un arquitecto de automatización que ayuda a diseñar flujos de trabajo.

### 📊 Panel y administración

- 📈 **Panel de control** con métricas reales: tokens generados, coste estimado, archivos procesados, salud del sistema, gráficas de actividad y mapa de calor de uso.
- 🗂️ **Registro de Actividad** con trazabilidad técnica (IP, país aproximado, navegador, sistema operativo, dispositivo, sesión, etc.).
- ⚖️ **Sistema de términos legales** conforme al RGPD, con aceptación bloqueante y registro de aceptaciones.
- 🖥️ **Estado del servidor** en tiempo real y configuración del motor de prompts.
- 🔐 Autenticación de administrador, límites de peticiones (*rate limiting*) y respaldos automáticos.

### 🤝 Proveedores de IA integrados

| Proveedor | Modelos |
|-----------|---------|
| 🟢 **OpenAI** | GPT-4o y otros |
| 🔵 **Google Gemini** | Gemini 2.x |
| 🟠 **Anthropic Claude** | Claude Sonnet y otros |

> 🔒 Las claves de API se gestionan exclusivamente en el servidor y nunca se exponen al cliente.

---

## 🛠️ Stack tecnológico

**🎨 Frontend**
- ⚛️ React 19 + TypeScript
- ⚡ Vite 6
- 💨 Tailwind CSS 4
- 📊 Recharts · 🎯 Lucide · 🔔 Sonner · 📄 React Markdown · 🎬 Framer Motion

**🔩 Backend**
- 🟩 Node.js + Express 4
- 🏃 Ejecución con `tsx` (TypeScript sin compilación previa)
- 🤖 SDKs oficiales de OpenAI, Google Generative AI y Anthropic
- 📎 Multer · 🕸️ Cheerio · 📄 Mammoth y pdf-parse · 🗜️ JSZip
- 📘 Swagger (documentación de la API en `/api/docs`)
- 🛡️ express-rate-limit

**💾 Persistencia**
- Almacenamiento en archivos JSON en el servidor (base de datos ligera, sin motor externo).

---

## 📋 Requisitos

- 🟩 Node.js 18 o superior
- 📦 npm
- 🔑 Claves de API de al menos uno de los proveedores de IA (OpenAI, Gemini o Anthropic)

---

## 📥 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/jflorperitociberseguridad/markitplace.git
cd markitplace

# Instalar dependencias
npm install
```

---

## ⚙️ Configuración

La aplicación lee su configuración de variables de entorno. Copia el archivo de ejemplo y complétalo con tus valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|----------|-------------|
| `PORT` | 🔌 Puerto del servidor (por defecto 3000) |
| `ADMIN_PASSWORD` | 🔐 Contraseña de administración de la consola |
| `OPENAI_API_KEY` | 🟢 Clave de API de OpenAI |
| `GEMINI_API_KEY` | 🔵 Clave de API de Google Gemini |
| `ANTHROPIC_API_KEY` | 🟠 Clave de API de Anthropic Claude |
| `DEFAULT_PROVIDER` | 🎛️ Proveedor por defecto (`openai`, `gemini` o `claude`) |
| `DEFAULT_MODEL` | 🧠 Modelo por defecto (por ejemplo `gpt-4o`) |

> ⚠️ **Importante:** las claves de API y la contraseña de administración nunca deben subirse al repositorio. El archivo con las claves reales está excluido mediante `.gitignore`.

---

## 🚀 Uso en desarrollo

```bash
# Arrancar el servidor (frontend + backend con Vite en modo desarrollo)
npm run dev
```

La aplicación quedará disponible en `http://localhost:3000` (o el puerto configurado).

🔍 Comprobación de tipos:

```bash
npm run lint
```

---

## 📦 Compilación y producción

```bash
# Compilar el frontend
npm run build

# Arrancar en producción
npm run start
```

En producción, el servidor sirve los archivos estáticos generados en `dist/` y expone la API en las mismas rutas.

### 🔄 Despliegue con PM2

La aplicación está preparada para ejecutarse en un VPS mediante PM2:

```bash
# Compilar
npm run build

# Arrancar / reiniciar el proceso
pm2 restart markitplace
```

La configuración del proceso y las variables de entorno se definen en un archivo `ecosystem.config.cjs` propio del servidor (no incluido en el repositorio por contener credenciales).

---

## 📘 Documentación de la API

Con el servidor en marcha, la documentación interactiva (Swagger) está disponible en:

```
/api/docs
```

🔑 Los endpoints protegidos requieren un token de sesión obtenido en `/api/auth`.

---

## 📂 Estructura del proyecto

```
markitplace/
├── src/
│   ├── components/     🧩 Componentes de React (Dashboard, PromptGenerator, etc.)
│   ├── assets/         🖼️ Recursos gráficos
│   ├── auth.ts         🔐 Gestión de sesión en el cliente
│   └── ...
├── components/ui/      🎨 Componentes de interfaz reutilizables
├── public/             📁 Archivos estáticos e iconos
├── skills-api/         🧱 Servicio auxiliar para el catálogo de skills
├── server.ts           🔩 Servidor Express (API + servido de la app)
├── vite.config.ts      ⚡ Configuración de Vite
└── package.json
```

---

## 🔒 Privacidad y protección de datos

La plataforma registra datos técnicos de uso (dirección IP, fecha y hora, navegador, sistema operativo, identificadores de sesión, consultas y respuestas) con fines de seguridad, trazabilidad y mejora del servicio, conforme al **RGPD** y la **LOPDGDD**. El contenido introducido puede enviarse a los proveedores de IA integrados para generar las respuestas. Los usuarios deben aceptar los términos de uso y la política de privacidad antes de utilizar la aplicación.

> 📌 La documentación legal completa es una plantilla orientativa y debe ser revisada por un profesional de protección de datos antes de su uso definitivo con usuarios externos.

---

## 📄 Licencia y titularidad

Proyecto titularidad de **Francisco Javier Flor González** — Cibermedida.

Uso interno y formativo. Todos los derechos reservados salvo indicación expresa.

---

## 📬 Contacto

- 🌐 Web: [cibermedida.es](https://cibermedida.es)
- 🧪 Plataforma: [markitplace.cibermedida.es](https://markitplace.cibermedida.es)

<div align="center">

---

Hecho con 💙 por **Cibermedida**

</div>
