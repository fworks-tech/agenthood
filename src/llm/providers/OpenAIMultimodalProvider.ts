import type OpenAI from 'openai'
import { toFile } from 'openai/uploads'
import { OpenAIProvider } from './OpenAIProvider.ts'
import type {
  AudioInput,
  AudioResult,
  IMultimodalProvider,
  ImageGenOptions,
  ImageResult,
  ModalPart,
  MultimodalRequest,
  TTSOptions,
  TranscriptionResult,
  VideoResult,
} from '../IMultimodalProvider.ts'
import type { LLMConfig, LLMResponse } from '../types.ts'
import { UnsupportedOperationError } from '../errors.ts'

const VISION_MODEL = 'gpt-4o'
const IMAGE_MODEL = 'dall-e-3'
const TTS_MODEL = 'tts-1'
const STT_MODEL = 'whisper-1'

const AUDIO_MIME: Record<NonNullable<TTSOptions['format']>, string> = {
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pcm: 'audio/pcm',
}

/**
 * OpenAI multimodal provider (#124): GPT-4o vision, DALL·E 3, TTS and Whisper.
 * Chat, streaming and embeddings stay with the parent provider — this class only
 * adds the modalities OpenAI actually serves today.
 */
export class OpenAIMultimodalProvider extends OpenAIProvider implements IMultimodalProvider {
  constructor(config: LLMConfig) {
    super(config)
  }

  private get sdk(): OpenAI {
    return this.client as OpenAI
  }

  async completeMultimodal(request: MultimodalRequest): Promise<LLMResponse> {
    const content = request.parts.map(toChatPart)
    const response = await this.sdk.chat.completions.create({
      model: this._model || VISION_MODEL,
      messages: [
        ...(request.system ? [{ role: 'system' as const, content: request.system }] : []),
        { role: 'user' as const, content },
      ],
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
    })

    const choice = response.choices[0]
    return {
      content: typeof choice?.message?.content === 'string' ? choice.message.content : '',
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      model: response.model,
      provider: 'openai',
    }
  }

  async generateImage(prompt: string, options: ImageGenOptions = {}): Promise<ImageResult> {
    const response = await this.sdk.images.generate({
      model: IMAGE_MODEL,
      prompt,
      n: options.n ?? 1,
      size: options.size ?? '1024x1024',
      quality: options.quality ?? 'standard',
    })
    const images = response.data ?? []
    const urls = images.flatMap((image) => (image.url ? [image.url] : []))
    const b64 = images.flatMap((image) => (image.b64_json ? [image.b64_json] : []))
    const revised = images[0]?.revised_prompt
    return {
      urls,
      ...(b64.length > 0 ? { b64 } : {}),
      model: IMAGE_MODEL,
      ...(revised ? { revisedPrompt: revised } : {}),
    }
  }

  async textToSpeech(text: string, options: TTSOptions = {}): Promise<AudioResult> {
    const format = options.format ?? 'mp3'
    const response = await this.sdk.audio.speech.create({
      model: TTS_MODEL,
      voice: options.voice ?? 'alloy',
      input: text,
      response_format: format,
      ...(options.speed === undefined ? {} : { speed: options.speed }),
    })
    return { data: Buffer.from(await response.arrayBuffer()), mimeType: AUDIO_MIME[format] }
  }

  async speechToText(audio: AudioInput): Promise<TranscriptionResult> {
    const file = await toFile(audio.data, audio.filename ?? 'audio.webm')
    const response = await this.sdk.audio.transcriptions.create({ file, model: STT_MODEL })
    return { text: response.text }
  }

  /** No stable video API exists; the shape is fixed so a caller can branch on it. */
  async generateVideo(_prompt: string): Promise<VideoResult> {
    return {
      status: 'not_implemented',
      availableIn: 'v4.1.0',
      reason: 'Video generation APIs are not stable enough to integrate yet.',
    }
  }
}

/** Vision parts as chat content; audio has no chat content type and fails loudly. */
function toChatPart(part: ModalPart):
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } } {
  switch (part.type) {
    case 'text':
      return { type: 'text', text: part.content }
    case 'image_url':
      return { type: 'image_url', image_url: { url: part.url } }
    case 'image_base64':
      return { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } }
    case 'audio_base64':
      throw new UnsupportedOperationError('audio input in a chat request (use speechToText)', 'openai')
  }
}
