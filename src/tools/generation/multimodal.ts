import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { IMultimodalProvider } from '../../llm/IMultimodalProvider.ts'
import { isMultimodalProvider } from '../../llm/IMultimodalProvider.ts'
import type { ToolResult } from '../ITool.ts'

export const UNSUPPORTED_MESSAGE =
  'This provider has no generation support. Configure an OpenAI provider (OPENAI_API_KEY) for image, speech and video generation.'

/** The run's provider, or undefined when it cannot serve the modality (#124). */
export function multimodalProvider(context: ExecutionContext): IMultimodalProvider | undefined {
  return isMultimodalProvider(context.llm) ? context.llm : undefined
}

export function failed(err: unknown): ToolResult {
  return { success: false, output: '', error: err instanceof Error ? err.message : String(err) }
}
