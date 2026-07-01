export interface PromptVariable {
  name: string;
  value: string;
}

export interface PromptVersion {
  content: string;
  savedAt: number;
}

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  type: 'basic' | 'advanced' | 'automation' | 'picard' | 'template' | 'markdown' | 'json';
  variables?: PromptVariable[];
  tags: string[];
  category: string;
  isFavorite: boolean;
  createdAt: number;
  versions?: PromptVersion[];
}

export interface AppStats {
  totalTokens: number;
  totalSavings: number;
  filesProcessed: number;
}

export interface DB {
  prompts: SavedPrompt[];
  automations: SavedPrompt[];
  skills: SavedPrompt[];
  markdowns: SavedPrompt[];
  jsons: SavedPrompt[];
  stats: AppStats;
}

export interface PromptLogEntry {
  id: string;
  fecha: string;
  hora: string;
  timestamp: string;
  ip: string;
  endpoint: string;
  provider: string;
  model: string;
  prompt: string;
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

export interface AutosaveEntry {
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
