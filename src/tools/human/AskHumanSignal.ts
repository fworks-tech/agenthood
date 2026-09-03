/** fx-style question payload carried from the agent to the human room. */
export interface AskHumanQuestionItem {
  label: string
  description?: string
  options?: string[]
}

export interface AskHumanQuestions {
  questions: AskHumanQuestionItem[]
}

/**
 * Control-flow signal, not a failure: thrown by the ask_human tool to park
 * the run until a human replies. ReActLoop must rethrow this instead of
 * stringifying it into model context (see executeTool) — a parked run has no
 * tool result to observe, only a question waiting in the room.
 */
export class AskHumanSignal extends Error {
  readonly questions: AskHumanQuestions

  constructor(questions: AskHumanQuestions) {
    super(`asking human: ${questions.questions.map((q) => q.label).join('; ')}`)
    this.name = 'AskHumanSignal'
    this.questions = questions
  }
}
