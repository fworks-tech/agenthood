import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ImageGenerationTool } from '../../../../src/tools/generation/ImageGenerationTool.ts'
import { SpeechToTextTool, TextToSpeechTool, speechOutputPath } from '../../../../src/tools/generation/SpeechTools.ts'
import { VideoGenerationTool } from '../../../../src/tools/generation/VideoGenerationTool.ts'
import { UNSUPPORTED_MESSAGE } from '../../../../src/tools/generation/multimodal.ts'
import { createTestContext } from '../../../helpers/testContext.ts'
import type { IMultimodalProvider } from '../../../../src/llm/IMultimodalProvider.ts'
import type { ILLMProvider } from '../../../../src/llm/ILLMProvider.ts'

function multimodal(overrides: Partial<IMultimodalProvider> = {}): IMultimodalProvider {
  return {
    complete: vi.fn(),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: () => 128000,
    setModel: vi.fn(),
    completeMultimodal: vi.fn(),
    generateImage: vi.fn().mockResolvedValue({ urls: ['https://img.test/a.png'], model: 'dall-e-3' }),
    textToSpeech: vi.fn().mockResolvedValue({ data: Buffer.from('audio-bytes'), mimeType: 'audio/mpeg' }),
    speechToText: vi.fn().mockResolvedValue({ text: 'transcribed words' }),
    generateVideo: vi.fn().mockResolvedValue({ status: 'not_implemented', availableIn: 'v4.1.0' }),
    ...overrides,
  }
}

let projectPath: string

beforeEach(() => {
  projectPath = mkdtempSync(join(tmpdir(), 'multimodal-'))
})

afterEach(() => {
  rmSync(projectPath, { recursive: true, force: true })
})

describe('multimodal tools (#124)', () => {
  it('returns the generated image URL', async () => {
    const context = createTestContext()
    context.llm = multimodal()
    const result = await new ImageGenerationTool().execute({ prompt: 'a lighthouse' }, context)
    expect(result.success).toBe(true)
    expect(result.output).toContain('https://img.test/a.png')
  })

  it('fails with the capability, not a fake result, on a text-only provider', async () => {
    const context = createTestContext()
    const result = await new ImageGenerationTool().execute({ prompt: 'a lighthouse' }, context)
    expect(result.success).toBe(false)
    expect(result.error).toBe(UNSUPPORTED_MESSAGE)
  })

  it('writes speech under .agenthood/media/speech and reports it', async () => {
    const context = createTestContext()
    context.project.localPath = projectPath
    context.llm = multimodal()

    const result = await new TextToSpeechTool().execute({ text: 'hello', format: 'mp3' }, context)

    const path = speechOutputPath(projectPath, 'hello', 'mp3')
    expect(result.success).toBe(true)
    expect(result.output).toContain(path)
    expect(readFileSync(path).toString()).toBe('audio-bytes')
  })

  it('transcribes a project audio file and refuses a path outside it', async () => {
    const context = createTestContext()
    context.project.localPath = projectPath
    context.llm = multimodal()
    writeFileSync(join(projectPath, 'note.wav'), 'audio')

    const ok = await new SpeechToTextTool().execute({ path: 'note.wav' }, context)
    const escaped = await new SpeechToTextTool().execute({ path: '../secret.wav' }, context)

    expect(ok.success).toBe(true)
    expect(ok.output).toBe('transcribed words')
    expect(escaped.success).toBe(false)
  })

  it('reports the video stub shape instead of failing', async () => {
    const context = createTestContext()
    context.llm = multimodal()
    const result = await new VideoGenerationTool().execute({ prompt: 'a sunrise' }, context)
    expect(result.success).toBe(true)
    expect(JSON.parse(result.output)).toMatchObject({ status: 'not_implemented', availableIn: 'v4.1.0' })
  })

  it('does not mistake a text-only provider for a multimodal one', async () => {
    const context = createTestContext()
    context.llm = { getContextWindow: () => 8192 } as unknown as ILLMProvider
    const result = await new VideoGenerationTool().execute({ prompt: 'x' }, context)
    expect(result.error).toBe(UNSUPPORTED_MESSAGE)
  })
})
