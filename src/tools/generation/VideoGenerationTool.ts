import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { ITool, ToolResult } from '../ITool.ts'
import type { JSONSchema } from '../../llm/types.ts'
import { UNSUPPORTED_MESSAGE, failed, multimodalProvider } from './multimodal.ts'

/**
 * Video generation is interface-only (#124): no API is stable enough to
 * integrate. The tool reports the stub shape instead of failing, so a workflow
 * can branch on `status` and a future implementation keeps the same contract.
 */
export class VideoGenerationTool implements ITool {
  name = 'generate_video'
  description =
    'Request video generation. Currently reports that the modality is not implemented; the shape is stable for 4.1.'
  inputSchema: JSONSchema = {
    type: 'object',
    properties: { prompt: { type: 'string', description: 'What the video should show' } },
    required: ['prompt'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    const { prompt } = input as { prompt: string }
    if (!prompt?.trim()) return { success: false, output: '', error: '`prompt` is required.' }

    const provider = multimodalProvider(context)
    if (!provider) return { success: false, output: '', error: UNSUPPORTED_MESSAGE }

    try {
      return { success: true, output: JSON.stringify(await provider.generateVideo(prompt)) }
    } catch (err) {
      return failed(err)
    }
  }
}
