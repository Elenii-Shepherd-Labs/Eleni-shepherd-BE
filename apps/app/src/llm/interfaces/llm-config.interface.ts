export interface LlmConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
}

export interface LlmResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}
