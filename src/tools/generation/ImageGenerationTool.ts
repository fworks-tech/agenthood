import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { ITool, ToolResult } from '../ITool.ts'
import type { JSONSchema } from '../../llm/types.ts'
import { UNSUPPORTED_MESSAGE, failed, multimodalProvider } from './multimodal.ts'

interface Input {
  prompt: string
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
}

export class ImageGenerationTool implements ITool {
  name = 'generate_image'
  description =
    'Generate an image from a text prompt with the configured multimodal provider. Returns the image URL (and base64 when the provider supplies it).'
  inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'What the image should show' },
      size: { type: 'string', enum: ['1024x1024', '1792x1024', '1024x1792'] },
      quality: { type: 'string', enum: ['standard', 'hd'] },
    },
    required: ['prompt'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    const { prompt, size, quality } = input as Input
    if (!prompt?.trim()) return { success: false, output: '', error: '`prompt` is required.' }

    const provider = multimodalProvider(context)
    if (!provider) return { success: false, output: '', error: UNSUPPORTED_MESSAGE }

    try {
      const result = await provider.generateImage(prompt, { size, quality })
      if (result.urls.length === 0 && !result.b64?.length) {
        return { success: false, output: '', error: 'The provider returned no image.' }
      }
      const lines = [
        ...result.urls.map((url) => `image_url: ${url}`),
        ...(result.b64?.length ? [`image_base64: ${result.b64.length} image(s), inline`] : []),
        `model: ${result.model}`,
        ...(result.revisedPrompt ? [`revised_prompt: ${result.revisedPrompt}`] : []),
      ]
      return { success: true, output: lines.join('\n') }
    } catch (err) {
      return failed(err)
    }
  }
}
