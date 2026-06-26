export class BudgetExceededError extends Error {
  constructor(steps: number, maxSteps: number) {
    super(`Thinking budget exceeded after ${steps} steps (max ${maxSteps})`)
    this.name = 'BudgetExceededError'
  }
}

export class ThinkingBudget {
  constructor(
    private maxSteps: number = 20,
    private maxTokens?: number
  ) {
    void this.maxTokens
    if (maxSteps > 20) {
      throw new Error('ThinkingBudget: maxSteps cannot exceed 20')
    }
  }

  check(step: number): void {
    if (this.isExhausted(step)) {
      throw new BudgetExceededError(step, this.maxSteps)
    }
  }

  isExhausted(step: number): boolean {
    return step >= this.maxSteps
  }
}
