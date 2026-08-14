export type TaskDifficulty = 'easy' | 'medium' | 'hard'

export interface EvalTask {
  input: string
  expectedOutput: string
  tags?: string[]
  difficulty?: TaskDifficulty
}

export interface EvalSuite {
  name: string
  description?: string
  tasks: EvalTask[]
  metrics?: string[]
  baseline?: string
}
