import pino from 'pino'

let jsonMode = false

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled
}

export function isJsonMode(): boolean {
  return jsonMode
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: jsonMode
    ? { target: 'pino/file', options: { destination: 1 } }
    : undefined,
  base: undefined,
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
})

export function logOutput(data: Record<string, unknown>): void {
  if (jsonMode) {
    logger.info(data)
  }
}
