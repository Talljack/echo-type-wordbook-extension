export type EnrichmentStatus = "pending" | "enriching" | "ready" | "partial" | "failed";

export interface WordExample {
  text: string;
  translation: string;
  source: "dictionary" | "daily" | "business" | "movie" | "context" | "ai";
}

export interface WordEntry {
  id: string;
  word: string;
  bookId: string;
  translation: string;
  pronunciation: string;
  partOfSpeech: string;
  definitions: string[];
  synonyms: string[];
  antonyms: string[];
  examples: WordExample[];
  context: string;
  sourceUrl: string;
  sourceTitle: string;
  note: string;
  tags: string[];
  encounters: number;
  mastery: 0 | 1 | 2 | 3 | 4;
  enrichmentStatus: EnrichmentStatus;
  enrichmentProvider: string;
  createdAt: number;
  updatedAt: number;
}

export interface WordBook {
  id: string;
  name: string;
  color: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export type ProviderProtocol = "openai" | "anthropic" | "google" | "ollama";

export interface ProviderDefinition {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  defaultModel: string;
  requiresApiKey: boolean;
  editableBaseUrl: boolean;
}

export interface AiProviderConfig {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ExtensionSettings {
  activeBookId: string;
  autoEnrich: boolean;
  aiEnabled: boolean;
  aiProvider: AiProviderConfig;
}

export interface PendingSelection {
  word: string;
  context: string;
  sourceUrl: string;
  sourceTitle: string;
  capturedAt: number;
}

export interface EnrichmentResult {
  translation?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  definitions: string[];
  synonyms: string[];
  antonyms: string[];
  examples: WordExample[];
  provider?: string;
}
