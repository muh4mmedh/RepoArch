export type AIProvider = 'gemini' | 'openai' | 'anthropic';

export interface AISettings {
  provider: AIProvider;
  geminiKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
  temperature: number;
  maxTokens: number;
  rateLimit: number;
}

export interface UsageStats {
  totalCost: number;
  requestCount: number;
  lastReset: string;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  githubAccessToken?: string;
  githubUsername?: string;
  aiSettings?: AISettings;
  usageStats?: UsageStats;
  createdAt: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  language: string | null;
  updated_at: string;
}

export interface RepositoryAnalysis {
  id: string;
  uid: string;
  repoName: string;
  repoFullName: string;
  repoUrl: string;
  analysisMarkdown: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  analysisId: string;
  uid: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
