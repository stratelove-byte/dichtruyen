export enum SourceLanguage {
  KOREAN = 'Korean',
  SPANISH = 'Spanish',
  AUTO = 'Auto-Detect'
}

export enum ModelProvider {
  GEMINI = 'Gemini 3.0 Pro',
  CLAUDE = 'Claude 3.5 Sonnet'
}

export interface TranslationSegment {
  source: string;
  target: string;
}

export interface TranslationResult {
  detectedLanguage: string;
  segments: TranslationSegment[];
}

export interface ProcessedImage {
  file: File;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
  status: AppState;
  result: TranslationResult | null;
  error: string | null;
}