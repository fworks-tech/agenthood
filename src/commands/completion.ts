import type { CommandDescriptor } from './types.ts'
import { ALL_MEMBERS } from '../members.ts'

const COMMANDS = [
  'init', 'setup', 'check', 'activate', 'deactivate', 'run', 'list',
  'verify', 'rollback', 'status', 'trace', 'log', 'health', 'eval',
  'workflow', 'pr-sync', 'oath', 'eject', 'mcp', 'publish', 'checkpoints',
  'install', 'completion',
]

const RUN_FLAGS = ['--provider', '--detect', '--resume', '--debug']

function generateBash(): string {
  const memberNames = ALL_MEMBERS.map((m) => m.name).join(' ')
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
      COMPREPLY=( $(compgen -W "--provider --detect --resume --debug" -- "\${cur}") )
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
      verify|rollback)
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
  const memberNames = ALL_MEMBERS.map((m) => m.name).join(' ')

  return `#compdef agenthood

# Zsh completion for agenthood
_agenthood() {
  local -a commands members
  commands=(
    'init:Initiate the Society in your project'
    'setup:Activate hooks and commit template'
    'check:Run the Doorman health check'
    'activate:Activate a specific member skill'
    'deactivate:Deactivate a member skill'
    'run:Run a Society member'
    'list:List all members and status'
    'verify:Validate member SKILL.md integrity'
    'rollback:Restore member SKILL.md from lockfile'
    'status:Show project health and member metrics'
    'trace:List recent member invocation traces'
    'log:List recent log entries'
    'health:Check runtime health'
    'eval:Run an eval suite against a member'
    'workflow:Execute a workflow'
    'pr-sync:Sync PR body and post comment'
    'oath:Print the Society oath'
    'eject:Remove the Society from your project'
    'mcp:Start MCP server'
    'publish:Publish a skill to the registry'
    'checkpoints:List past run checkpoints'
    'install:Install a skill from a URL'
    'completion:Generate shell completion scripts'
  )

  members=(${memberNames})

  _arguments -C \
    '1:command:->command' \
    '*::arg:->args'

  case \$state in
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
            '--debug[Log full LLM request/response]'
          case \$state in
            member) _describe 'member' members ;;
          esac
          ;;
        activate|deactivate|verify|rollback|eval)
          _arguments '1:member:->member'
          case \$state in
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
          case \$state in
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
  const memberNames = ALL_MEMBERS.map((m) => m.name).join(' ')

  return `# Fish completion for agenthood

# Command completions
complete -c agenthood -n '__fish_use_subcommand' -a init -d 'Initiate the Society in your project'
complete -c agenthood -n '__fish_use_subcommand' -a setup -d 'Activate hooks and commit template'
complete -c agenthood -n '__fish_use_subcommand' -a check -d 'Run the Doorman health check'
complete -c agenthood -n '__fish_use_subcommand' -a activate -d 'Activate a specific member skill'
complete -c agenthood -n '__fish_use_subcommand' -a deactivate -d 'Deactivate a member skill'
complete -c agenthood -n '__fish_use_subcommand' -a run -d 'Run a Society member'
complete -c agenthood -n '__fish_use_subcommand' -a list -d 'List all members and status'
complete -c agenthood -n '__fish_use_subcommand' -a verify -d 'Validate member SKILL.md integrity'
complete -c agenthood -n '__fish_use_subcommand' -a rollback -d 'Restore member SKILL.md from lockfile'
complete -c agenthood -n '__fish_use_subcommand' -a status -d 'Show project health and member metrics'
complete -c agenthood -n '__fish_use_subcommand' -a trace -d 'List recent member invocation traces'
complete -c agenthood -n '__fish_use_subcommand' -a log -d 'List recent log entries'
complete -c agenthood -n '__fish_use_subcommand' -a health -d 'Check runtime health'
complete -c agenthood -n '__fish_use_subcommand' -a eval -d 'Run an eval suite against a member'
complete -c agenthood -n '__fish_use_subcommand' -a workflow -d 'Execute a workflow'
complete -c agenthood -n '__fish_use_subcommand' -a pr-sync -d 'Sync PR body and post comment'
complete -c agenthood -n '__fish_use_subcommand' -a oath -d 'Print the Society oath'
complete -c agenthood -n '__fish_use_subcommand' -a eject -d 'Remove the Society from your project'
complete -c agenthood -n '__fish_use_subcommand' -a mcp -d 'Start MCP server'
complete -c agenthood -n '__fish_use_subcommand' -a publish -d 'Publish a skill to the registry'
complete -c agenthood -n '__fish_use_subcommand' -a checkpoints -d 'List past run checkpoints'
complete -c agenthood -n '__fish_use_subcommand' -a install -d 'Install a skill from a URL'
complete -c agenthood -n '__fish_use_subcommand' -a completion -d 'Generate shell completion scripts'

# Member completions for run/activate/deactivate/verify/rollback/eval
for member in ${memberNames}
  complete -c agenthood -n "__fish_seen_subcommand_from run activate deactivate verify rollback eval" -a "$member"
end

# Run flags
complete -c agenthood -n '__fish_seen_subcommand_from run' -l provider -d 'Override LLM provider'
complete -c agenthood -n '__fish_seen_subcommand_from run' -l detect -d 'Auto-detect members'
complete -c agenthood -n '__fish_seen_subcommand_from run' -l resume -d 'Resume from checkpoint'
complete -c agenthood -n '__fish_seen_subcommand_from run' -l debug -d 'Log LLM request/response'

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
