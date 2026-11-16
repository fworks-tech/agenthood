# Agenthood (em português)

> *Um time completo de engenharia de IA que merece cada merge.*

O Agenthood é um conjunto de 20 agentes de IA especializados (arquiteto,
revisor, auditor de segurança, engenheiro DevOps e mais), como arquivos de
skill Markdown portáteis, um runtime TypeScript autônomo e um Studio no
navegador. Sem cadastro. Funciona com qualquer runtime de agente.

**O Agenthood 4.0 chegou.** Membros e workflows agora são dados: registre
agentes próprios em runtime, declare cadeias em `chains.yaml` e mantenha o
mesmo rastro de decisões, traces e proveniência. As mudanças que exigem ação
estão no [MIGRATION.md](MIGRATION.md).

## O que há de novo na 4.0

- **Compose.** Membros customizados e workflows declarados em `chains.yaml`.
- **Contratos de skill.** `allowed-tools` limita o que o modelo pode chamar.
- **Scripts em sandbox.** Runtimes fixos, Docker ou nada, com log de auditoria.
- **Custo e saúde.** `status`, `health`, `trace --activations` e `optimize --cost`.

O histórico completo está nas [notas de release](docs/release-notes.md).

## Instalação em 5 minutos

```bash
npm install --save-dev agenthood
npx agenthood init       # configuração interativa (~2 minutos)
npx agenthood check      # verifica se está tudo funcionando
```

Requisitos: Node.js 22+, `git` e `gh` CLI. [Use o plano gratuito da Groq,
sem cartão de crédito](docs/guides/groq-zero-cost-setup.md).

## Seu primeiro commit

1. **Escreva código**: faça alterações no seu projeto.
2. **Selecione**: `git add -p`
3. **Commit**: `git commit`. O Doorman valida sua mensagem (conventional commits).
4. **Push**: hooks de pre-push rodam os testes antes do branch sair da sua máquina.
5. **Abra um PR**: o corpo vem pré-preenchido (`O que mudou`, `Por quê`, `Como testar`).
6. **Revise**: o Reviewer verifica corretude, segurança, performance e cobertura.

## Comandos essenciais

| Comando | O que faz |
|---------|-----------|
| `npx agenthood init` | Instala hooks, templates e skills no seu projeto |
| `npx agenthood check` | Verifica se o Society está operacional |
| `npx agenthood run <membro> "<tarefa>"` | Invoca um membro como agente autônomo |
| `npx agenthood list` | Lista todos os membros |

## Próximos passos

- [Guia Groq custo-zero](docs/guides/groq-zero-cost-setup.md): rode de graça
- [Criação de skill em 5 minutos](docs/academy/quickstart.md)
- [Documentação completa em inglês](README.md): Academy, Studio, arquitetura
