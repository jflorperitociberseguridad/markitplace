// Recopila datos técnicos del navegador para el registro de actividad.
// La IP, el país y la hora los capta el servidor; aquí se obtiene lo que solo el cliente conoce.
export function getClientMeta() {
  try {
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

    // Navegador y versión (el orden importa: Edge/Opera comparten cadena con Chrome)
    let browser = "desconocido";
    let browserVersion = "";
    const m = (re: RegExp) => { const x = ua.match(re); return x ? x[1] : ""; };
    if (/Edg\//.test(ua)) { browser = "Edge"; browserVersion = m(/Edg\/([\d.]+)/); }
    else if (/OPR\//.test(ua) || /Opera/.test(ua)) { browser = "Opera"; browserVersion = m(/(?:OPR|Opera)\/([\d.]+)/); }
    else if (/Firefox\//.test(ua)) { browser = "Firefox"; browserVersion = m(/Firefox\/([\d.]+)/); }
    else if (/Chrome\//.test(ua)) { browser = "Chrome"; browserVersion = m(/Chrome\/([\d.]+)/); }
    else if (/Safari\//.test(ua)) { browser = "Safari"; browserVersion = m(/Version\/([\d.]+)/); }

    // Tipo de dispositivo
    const deviceType = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
      ? (/iPad|Tablet/i.test(ua) ? "Tablet" : "Móvil")
      : "Ordenador";

    // Identificador técnico de sesión (solo traza esta sesión de navegador)
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
  } catch {
    return {};
  }
}
