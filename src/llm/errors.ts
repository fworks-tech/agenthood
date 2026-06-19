export class UnsupportedOperationError extends Error {
  constructor(operation: string, provider: string) {
    super(`${provider} does not support "${operation}"`)
    this.name = 'UnsupportedOperationError'
  }
}
