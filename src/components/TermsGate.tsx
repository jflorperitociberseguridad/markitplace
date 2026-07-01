import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  Eye,
  MapPin,
  Clock,
  FileText,
  Bot,
  ChevronDown,
  ChevronUp,
  Lock,
  Database,
  Server,
  Scale,
  Mail,
  AlertTriangle,
  Cookie,
  UserCheck,
  Globe,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

const STORAGE_KEY = "markitplace_terms_accepted";

const DEFAULT_TERMS_VERSION = "1.1";

// Recopila datos técnicos del navegador para el registro de aceptación.
// La IP y el país los capta el servidor; aquí se obtiene lo que solo el cliente conoce.
function collectClientData() {
  const ua = navigator.userAgent || "";
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || "";

  // Sistema operativo aproximado
  let os = "desconocido";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (platform) os = platform;

  // Navegador y versión aproximados (orden importa: Edge y Chrome comparten cadena)
  let browser = "desconocido";
  let browserVersion = "";
  const match = (re: RegExp) => { const m = ua.match(re); return m ? m[1] : ""; };
  if (/Edg\//.test(ua)) { browser = "Edge"; browserVersion = match(/Edg\/([\d.]+)/); }
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) { browser = "Opera"; browserVersion = match(/(?:OPR|Opera)\/([\d.]+)/); }
  else if (/Firefox\//.test(ua)) { browser = "Firefox"; browserVersion = match(/Firefox\/([\d.]+)/); }
  else if (/Chrome\//.test(ua)) { browser = "Chrome"; browserVersion = match(/Chrome\/([\d.]+)/); }
  else if (/Safari\//.test(ua)) { browser = "Safari"; browserVersion = match(/Version\/([\d.]+)/); }

  // Tipo de dispositivo
  const deviceType = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
    ? (/iPad|Tablet/i.test(ua) ? "Tablet" : "Móvil")
    : "Ordenador";

  // Identificador técnico de sesión (no persistente entre dispositivos; solo traza esta sesión)
  let sessionId = sessionStorage.getItem("markitplace_session_id");
  if (!sessionId) {
    sessionId = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + "-" + Date.now().toString(36);
    try { sessionStorage.setItem("markitplace_session_id", sessionId); } catch { /* sessionStorage puede estar bloqueado */ }
  }

  return {
    sessionId,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    language: navigator.language || "",
    screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    deviceType,
    browser,
    browserVersion,
    os,
  };
}

const DEFAULT_TERMS_CONTENT = `# Documentación legal de MarkItPlace Cibermedida

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

type StoredTermsAcceptance = {
  version?: string;
  date?: string;
};

export function TermsGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [termsVersion, setTermsVersion] = useState(DEFAULT_TERMS_VERSION);
  const [termsContent, setTermsContent] = useState(DEFAULT_TERMS_CONTENT);
  const [showFull, setShowFull] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get("/api/terms");
        const { version, content } = res.data ?? {};
        const currentVersion = version || DEFAULT_TERMS_VERSION;
        const currentContent = content || DEFAULT_TERMS_CONTENT;

        setTermsVersion(currentVersion);
        setTermsContent(currentContent);

        const stored = localStorage.getItem(STORAGE_KEY);
        let acceptedVersion: string | null = null;

        if (stored) {
          try {
            const parsed: StoredTermsAcceptance = JSON.parse(stored);
            acceptedVersion = parsed.version ?? null;
          } catch {
            acceptedVersion = null;
          }
        }

        setNeedsAcceptance(acceptedVersion !== currentVersion);
      } catch {
        // Si el servidor no responde, usamos los términos locales de seguridad.
        // No bloqueamos indefinidamente al usuario por un fallo técnico del endpoint.
        const stored = localStorage.getItem(STORAGE_KEY);
        let acceptedVersion: string | null = null;

        if (stored) {
          try {
            const parsed: StoredTermsAcceptance = JSON.parse(stored);
            acceptedVersion = parsed.version ?? null;
          } catch {
            acceptedVersion = null;
          }
        }

        setNeedsAcceptance(acceptedVersion !== DEFAULT_TERMS_VERSION);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, []);

  const accept = async () => {
    if (!checked) return;

    setSubmitting(true);

    const acceptedAt = new Date().toISOString();

    try {
      await axios.post("/api/accept-terms", {
        version: termsVersion,
        acceptedAt,
        source: "TermsGate",
        client: collectClientData(),
      });
    } catch {
      // Aunque falle el registro en servidor, guardamos la aceptación local.
      // El backend puede implementar su propio registro reforzado si lo necesita.
    } finally {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: termsVersion,
          date: acceptedAt,
        })
      );
      setNeedsAcceptance(false);
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!needsAcceptance) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[94vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2 text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-1">
            <ShieldAlert className="w-3.5 h-3.5" /> Antes de continuar
          </div>
          <h2 className="text-xl font-extrabold text-white">
            Privacidad, condiciones de uso y registro de actividad
          </h2>
          <p className="text-xs text-indigo-100 mt-2 leading-relaxed">
            MarkItPlace Cibermedida utiliza sistemas de inteligencia artificial y registra actividad técnica para proteger el servicio, mantener trazabilidad y mejorar su funcionamiento.
          </p>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              Para poder utilizar la plataforma debes conocer y aceptar cómo se tratan los datos asociados a tus consultas. MarkItPlace registra información técnica y operativa de cada interacción con fines de seguridad, auditoría, prevención de abusos, resolución de incidencias, mejora del servicio y cumplimiento normativo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800">Dirección IP</p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Se registra para seguridad, trazabilidad, prevención de abuso y detección de accesos anómalos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800">Fecha y hora</p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Cada acción queda asociada a un momento concreto para auditoría y resolución de incidencias.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800">Consultas realizadas</p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Pueden almacenarse preguntas, prompts, instrucciones y contenido introducido por el usuario.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <Bot className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800">Respuestas de IA</p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  También pueden conservarse las respuestas generadas para control de calidad y trazabilidad.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <Server className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800">Datos técnicos</p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Navegador, sistema operativo, sesión, eventos técnicos, errores e incidencias de seguridad.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <Database className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800">Logs de actividad</p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Se usan para auditoría, prevención de fraude, diagnóstico y mejora continua del servicio.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Bot className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                El contenido que introduces puede enviarse a OpenAI, Google Gemini o Anthropic Claude para generar resultados, conforme a sus propias condiciones y políticas de privacidad.
              </p>
            </div>

            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 leading-relaxed">
                No introduzcas contraseñas, claves API, datos de salud, información financiera completa, documentos de identidad, datos de menores ni información confidencial o de terceros sin autorización.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <Scale className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-900">Base legal</p>
                <p className="text-[11px] text-blue-800 leading-snug">
                  Ejecución del servicio, interés legítimo en seguridad y cumplimiento de obligaciones legales.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-900">Derechos RGPD</p>
                <p className="text-[11px] text-blue-800 leading-snug">
                  Puedes solicitar acceso, rectificación, supresión, oposición, limitación o portabilidad.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <Cookie className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-900">Cookies técnicas</p>
                <p className="text-[11px] text-blue-800 leading-snug">
                  Se pueden usar elementos técnicos necesarios, como recordar la aceptación de términos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-900">Contacto privacidad</p>
                <p className="text-[11px] text-blue-800 leading-snug break-all">
                  jfloradmin@cibermedida.es
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900 mb-1">
                  Transparencia antes de usar el chat
                </h3>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Las conversaciones pueden almacenarse para seguridad, auditoría, mejora del servicio y control de calidad. Las respuestas de IA son orientativas y pueden contener errores, por lo que deben verificarse antes de tomar decisiones importantes.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowFull(!showFull)}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
          >
            <Eye className="w-3.5 h-3.5" /> {showFull ? "Ocultar términos completos" : "Leer términos completos"}
            {showFull ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showFull && (
            <div className="prose prose-sm max-w-none bg-slate-50 border border-slate-100 rounded-xl p-4 max-h-96 overflow-y-auto text-slate-600 prose-headings:text-slate-900 prose-strong:text-slate-800 prose-li:my-0.5">
              <ReactMarkdown>{termsContent || DEFAULT_TERMS_CONTENT}</ReactMarkdown>
            </div>
          )}

          <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
            <Globe className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>
              Al continuar, confirmas que no introducirás datos especialmente sensibles, confidenciales o de terceros sin autorización y que revisarás las respuestas generadas por IA antes de utilizarlas en decisiones relevantes.
            </p>
          </div>
        </div>

        {/* Pie fijo: checkbox + botón siempre visibles */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 p-5 sm:p-6 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              He leído y acepto los <strong>Términos de Uso</strong>, la <strong>Política de Privacidad</strong> y la información sobre registro de actividad. Entiendo que mis consultas, respuestas generadas, datos técnicos, dirección IP, fecha, hora e identificadores de sesión pueden tratarse para prestar el servicio, mantener la seguridad, auditar el uso, resolver incidencias y mejorar la plataforma.
            </span>
          </label>

          <Button
            onClick={accept}
            disabled={!checked || submitting}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-widest text-xs h-11 disabled:opacity-40"
          >
            {submitting ? "Guardando…" : "Aceptar y continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
