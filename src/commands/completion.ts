import type { CommandDescriptor } from './types.ts'
import { ALL_MEMBERS } from '../members.ts'

/** Single source of truth for shell completions: every generator below
 * derives from this table, so adding a command means adding one row. */
const COMMAND_META: Array<{ name: string; blurb: string }> = [
  { name: 'init', blurb: 'Initiate the Society in your project' },
  { name: 'setup', blurb: 'Activate hooks and commit template' },
  { name: 'check', blurb: 'Run the Doorman health check' },
  { name: 'activate', blurb: 'Activate a specific member skill' },
  { name: 'deactivate', blurb: 'Deactivate a member skill' },
  { name: 'run', blurb: 'Run a Society member' },
  { name: 'list', blurb: 'List all members and status' },
  { name: 'verify', blurb: 'Validate member SKILL.md integrity' },
  { name: 'rollback', blurb: 'Restore member SKILL.md from lockfile' },
  { name: 'diff', blurb: 'Show member SKILL.md changes vs lockfile' },
  { name: 'status', blurb: 'Show project health and member metrics' },
  { name: 'stats', blurb: 'Show per-skill usage analytics' },
  { name: 'cost', blurb: 'Show cumulative cost breakdown' },
  { name: 'metrics', blurb: 'Export metrics to Prometheus or StatsD' },
  { name: 'trace', blurb: 'List recent member invocation traces' },
  { name: 'log', blurb: 'List recent log entries' },
  { name: 'health', blurb: 'Check runtime health' },
  { name: 'doctor', blurb: 'Run all diagnostics in one pass' },
  { name: 'eval', blurb: 'Run an eval suite against a member' },
  { name: 'workflow', blurb: 'Execute a workflow' },
  { name: 'pr-sync', blurb: 'Sync PR body and post comment' },
  { name: 'oath', blurb: 'Print the Society oath' },
  { name: 'eject', blurb: 'Remove the Society from your project' },
  { name: 'mcp', blurb: 'Start MCP server' },
  { name: 'publish', blurb: 'Publish a skill to the registry' },
  { name: 'checkpoints', blurb: 'List past run checkpoints' },
  { name: 'install', blurb: 'Install a skill from a URL' },
  { name: 'remove', blurb: 'Remove an installed skill' },
  { name: 'create', blurb: 'Scaffold a new skill from a template' },
  { name: 'completion', blurb: 'Generate shell completion scripts' },
]

const COMMANDS = COMMAND_META.map((c) => c.name)

/** Commands (besides run) that take a member name as their first positional. */
const MEMBER_COMMANDS = ['activate', 'deactivate', 'verify', 'rollback', 'diff', 'eval']

function allMemberNames(): string {
  return ALL_MEMBERS.map((m) => m.name).join(' ')
}

function generateBash(): string {
  const memberNames = allMemberNames()
  const commandNames = COMMANDS.join(' ')

  return `# Bash completion for agenthood
_agenthood_completions() {
  local cur prev commands members
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="${commandNames}"
  members="${memberNames}"

  # First argument: complete command names
  if [ "\${COMP_CWORD}" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    return 0
  fi

  # Second argument after 'run': complete member names
  if [ "\${COMP_WORDS[1]}" = "run" ] && [ "\${COMP_CWORD}" -eq 2 ]; then
    COMPREPLY=( $(compgen -W "\${members}" -- "\${cur}") )
    return 0
  fi

  # Flags after 'run <member>'
  if [ "\${COMP_WORDS[1]}" = "run" ] && [ "\${COMP_CWORD}" -ge 3 ]; then
    if [[ "\${cur}" == -* ]]; then
        COMPREPLY=( $(compgen -W "--provider --detect --resume --debug --sandbox" -- "\${cur}") )
    fi
    return 0
  fi

  # Flags after other commands
  if [[ "\${cur}" == -* ]]; then
    case "\${COMP_WORDS[1]}" in
      activate|deactivate)
        COMPREPLY=( $(compgen -W "\${members}" -- "\${cur}") )
        ;;
      trace|log)
        COMPREPLY=( $(compgen -W "--member --limit --since --json --level --help" -- "\${cur}") )
        ;;
      verify|rollback|diff)
        COMPREPLY=( $(compgen -W "\${members}" -- "\${cur}") )
        ;;
      status)
        COMPREPLY=( $(compgen -W "--watch --json --drift --member --learner" -- "\${cur}") )
        ;;
      eval)
        COMPREPLY=( $(compgen -W "\${members}" -- "\${cur}") )
        ;;
      completion)
        COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
        ;;
    esac
    return 0
  fi

  return 0
}

complete -F _agenthood_completions agenthood
`
}

function generateZsh(): string {
  const memberNames = allMemberNames()
  const commandLines = COMMAND_META.map((c) => `    '${c.name}:${c.blurb}'`).join('\n')

  return `#compdef agenthood

# Zsh completion for agenthood
_agenthood() {
  local -a commands members
  commands=(
${commandLines}
  )

  members=(${memberNames})

  _arguments -C \
    '1:command:->command' \
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case \${words[1]} in
        run)
          _arguments \
            '1:member:->member' \
            '2:task:' \
            '--provider[Override LLM provider]:provider:(groq anthropic openai ollama openrouter)' \
            '--detect[Auto-detect members for this task]' \
            '--resume[Resume from a checkpoint]:id:' \
            '--debug[Log full LLM request/response]' \
            '--sandbox[Run untrusted skills isolated]'
          case $state in
            member) _describe 'member' members ;;
          esac
          ;;
        ${MEMBER_COMMANDS.join('|')})
          _arguments '1:member:->member'
          case $state in
            member) _describe 'member' members ;;
          esac
          ;;
        trace|log)
          _arguments \
            '1:member:->member' \
            '--member[Filter by member]:member:' \
            '--limit[Maximum entries]:limit:' \
            '--since[Only entries newer than]:time:' \
            '--json[Machine-readable output]' \
            '--level[Filter by level]:level:(debug info warn error)' \
            '--help[Show help]'
          case $state in
            member) _describe 'member' members ;;
          esac
          ;;
        status)
          _arguments \
            '--watch[Poll every 5 seconds]' \
            '--json[Machine-readable output]' \
            '--drift[Detect SKILL.md drift]' \
            '--member[Per-member trace summaries]:member:' \
            '--learner[EpisodeLearner learning status]'
          ;;
        completion)
          _arguments '1:shell:(bash zsh fish)'
          ;;
      esac
      ;;
  esac
}

compdef _agenthood agenthood
`
}

function generateFish(): string {
  const memberNames = allMemberNames()
  const commandLines = COMMAND_META.map((c) => `complete -c agenthood -n '__fish_use_subcommand' -a ${c.name} -d '${c.blurb}'`).join('\n')

  return `# Fish completion for agenthood

# Command completions
${commandLines}

# Member completions for run/activate/deactivate/verify/rollback/diff/eval
for member in ${memberNames}
  complete -c agenthood -n "__fish_seen_subcommand_from run ${MEMBER_COMMANDS.join(' ')}" -a "$member"
end

# Run flags
complete -c agenthood -n '__fish_seen_subcommand_from run' -l provider -d 'Override LLM provider'
complete -c agenthood -n '__fish_seen_subcommand_from run' -l detect -d 'Auto-detect members'
complete -c agenthood -n '__fish_seen_subcommand_from run' -l resume -d 'Resume from checkpoint'
complete -c agenthood -n '__fish_seen_subcommand_from run' -l debug -d 'Log LLM request/response'
complete -c agenthood -n '__fish_seen_subcommand_from run' -l sandbox -d 'Run untrusted skills isolated'

# Completion shell argument
complete -c agenthood -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'
`
}

export const command: CommandDescriptor = {
  name: 'completion',
  description: 'Generate shell completion scripts',
  handler: (args) => completion(args),
}

export async function completion(args: string[]): Promise<void> {
  const shell = args.filter((a) => !a.startsWith('--'))[0]

  if (!shell || !['bash', 'zsh', 'fish'].includes(shell)) {
    console.error('\nUsage: agenthood completion <shell>\n')
    console.error('Supported shells:')
    console.error('  bash   Bash completion script')
    console.error('  zsh    Zsh completion script')
    console.error('  fish   Fish completion script\n')
    console.error('Add to your shell profile:')
    console.error('  bash:  eval "$(agenthood completion bash)"')
    console.error('  zsh:   eval "$(agenthood completion zsh)"')
    console.error('  fish:  agenthood completion fish > ~/.config/fish/completions/agenthood.fish\n')
    process.exit(1)
    return
  }

  switch (shell) {
    case 'bash':
      console.log(generateBash())
      break
    case 'zsh':
      console.log(generateZsh())
      break
    case 'fish':
      console.log(generateFish())
      break
  }
}
