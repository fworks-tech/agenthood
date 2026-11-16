import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { ITool, ToolResult } from '../ITool.ts'
import type { JSONSchema } from '../../llm/types.ts'
import { resolveInsideProject } from '../pathGuard.ts'
import { UNSUPPORTED_MESSAGE, failed, multimodalProvider } from './multimodal.ts'
import type { TTSOptions } from '../../llm/IMultimodalProvider.ts'

/** Audio lives with the other run artifacts, never in the project tree. */
export function speechOutputPath(projectPath: string, text: string, format: NonNullable<TTSOptions['format']>): string {
  const digest = createHash('sha256').update(text).digest('hex').slice(0, 16)
  return join(projectPath, '.agenthood', 'media', 'speech', `${digest}.${format}`)
}

export class TextToSpeechTool implements ITool {
  name = 'text_to_speech'
  description =
    'Convert text to an audio file with the configured multimodal provider. Returns the path under .agenthood/media/speech/.'
  inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'What to say' },
      voice: { type: 'string', description: 'Provider voice name; defaults to the provider default' },
      format: { type: 'string', enum: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] },
    },
    required: ['text'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    const { text, voice, format = 'mp3' } = input as { text: string; voice?: string; format?: NonNullable<TTSOptions['format']> }
    if (!text?.trim()) return { success: false, output: '', error: '`text` is required.' }

    const provider = multimodalProvider(context)
    if (!provider) return { success: false, output: '', error: UNSUPPORTED_MESSAGE }

    try {
      const audio = await provider.textToSpeech(text, { voice, format })
      const path = speechOutputPath(context.project.localPath, text, format)
      mkdirSync(join(path, '..'), { recursive: true })
      writeFileSync(path, audio.data)
      return {
        success: true,
        output: `audio_path: ${path}\nmime_type: ${audio.mimeType}\nbytes: ${audio.data.byteLength}`,
      }
    } catch (err) {
      return failed(err)
    }
  }
}

export class SpeechToTextTool implements ITool {
  name = 'speech_to_text'
  description =
    'Transcribe an audio file inside the project with the configured multimodal provider. Returns the transcript.'
  inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Audio file path, relative to the project root' },
    },
    required: ['path'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    const { path } = input as { path: string }
    if (!path?.trim()) return { success: false, output: '', error: '`path` is required.' }

    const provider = multimodalProvider(context)
    if (!provider) return { success: false, output: '', error: UNSUPPORTED_MESSAGE }

    const guarded = await resolveInsideProject(context.project.localPath, path)
    if (!guarded.ok) return { success: false, output: '', error: guarded.error }
    if (!existsSync(guarded.path)) return { success: false, output: '', error: `Audio file "${path}" not found.` }

    try {
      const result = await provider.speechToText({ data: readFileSync(guarded.path), filename: path })
      return { success: true, output: result.text }
    } catch (err) {
      return failed(err)
    }
  }
}
