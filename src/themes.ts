export type Theme = "light" | "sepia" | "indigo" | "midnight";
export const THEMES: { id: Theme; label: string; emoji: string }[] = [
  { id: "light",    label: "Claro",    emoji: "☀️" },
  { id: "sepia",    label: "Sepia",    emoji: "📜" },
  { id: "indigo",   label: "Índigo",   emoji: "💜" },
  { id: "midnight", label: "Midnight", emoji: "🌙" },
];
