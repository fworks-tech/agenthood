import type { ILLMProvider } from './ILLMProvider.ts'
import type { LLMResponse } from './types.ts'

/**
 * Multimodal extension of the provider interface (#124).
 *
 * Only the modalities that exist are declared. Video generation has a stable
 * signature but no stable API, so `generateVideo` reports `not_implemented`
 * rather than pretending; audio/music generation is left to 4.1.
 */

export type ModalPart =
  | { type: 'text'; content: string }
  | { type: 'image_url'; url: string }
  | { type: 'image_base64'; data: string; mimeType: string }
  | { type: 'audio_base64'; data: string; mimeType: string }

export interface MultimodalRequest {
  parts: ModalPart[]
  system?: string
  temperature?: number
  maxTokens?: number
}

export interface ImageGenOptions {
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  n?: number
}

export interface ImageResult {
  /** One entry per generated image: a URL, or base64 when the provider returns it. */
  urls: string[]
  b64?: string[]
  model: string
  revisedPrompt?: string
}

export interface TTSOptions {
  voice?: string
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'
  speed?: number
}

export interface AudioResult {
  data: Buffer
  mimeType: string
}

export interface AudioInput {
  data: Buffer
  /** Filename the provider sees; the extension tells it the container format. */
  filename?: string
}

export interface TranscriptionResult {
  text: string
  language?: string
}

/** A stable shape for a modality that has no stable API yet. */
export interface VideoResult {
  status: 'not_implemented'
  availableIn: string
  reason?: string
}

export interface IMultimodalProvider extends ILLMProvider {
  completeMultimodal(request: MultimodalRequest): Promise<LLMResponse>
  generateImage(prompt: string, options?: ImageGenOptions): Promise<ImageResult>
  textToSpeech(text: string, options?: TTSOptions): Promise<AudioResult>
  speechToText(audio: AudioInput): Promise<TranscriptionResult>
  generateVideo(prompt: string): Promise<VideoResult>
}

/** Capability check that survives the redaction Proxy in `LLMRouter`. */
export function isMultimodalProvider(provider: unknown): provider is IMultimodalProvider {
  const candidate = provider as Partial<IMultimodalProvider> | undefined
  return typeof candidate?.generateImage === 'function' && typeof candidate?.textToSpeech === 'function'
}
