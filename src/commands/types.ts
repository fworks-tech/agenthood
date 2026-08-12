export interface CommandDescriptor {
  /** Command name as typed on the CLI (e.g. 'pr-sync') */
  name: string
  /** Optional alternative names that also invoke this command */
  aliases?: string[]
  /** One-line description for `agenthood help` */
  description: string
  /** Receives the full argument array; commands parse their own flags */
  handler: (args: string[]) => Promise<void>
}
