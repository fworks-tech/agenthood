# Guia: Agenthood custo-zero com Groq

> 14.400 requisições por dia. Sem cartão de crédito. Do zero ao primeiro commit
> em 5 minutos.

## O que é o Agenthood

Um time de 20 agentes de IA para o ciclo de vida do software — commits, PRs,
revisão, segurança, releases — como skills Markdown portáteis mais um runtime
TypeScript que os executa de forma autônoma.

## Por que Groq?

O plano gratuito ([console.groq.com](https://console.groq.com)) não exige
cartão de crédito e cobre com folga o uso individual. O Agenthood usa Groq
como fallback na cadeia de providers (ver
[ADR-009](../adr/ADR-009-groq-as-default-llm-provider.md)).

## Setup em 5 minutos

### 1. Crie sua conta e chave

1. Acesse [console.groq.com](https://console.groq.com) e crie sua conta.
2. Gere uma API key (sem cartão de crédito).
3. No seu projeto, crie um `.env` (nunca commite este arquivo):

```bash
GROQ_API_KEY=sua-chave-aqui
```

### 2. Instale e configure

```bash
npm install --save-dev agenthood
npx agenthood init       # configuração interativa (~2 minutos)
npx agenthood check      # verifica se está tudo funcionando
```

### 3. Rode seu primeiro membro

```bash
npx agenthood run the-scribe "escreva uma mensagem de commit para o diff atual"
```

## Seu primeiro commit com The Scribe

1. `git add -p` — selecione as mudanças.
2. `git commit` — o Doorman valida a mensagem (conventional commits, minúsculas, imperativo).
3. Abra o PR — o corpo vem pré-preenchido; o Scribe o mantém sincronizado.

## Próximos passos

- [Criação de skill em 5 minutos](../academy/quickstart.md)
- [Versão em português](../../README.pt-BR.md) — instalação e comandos
- [Academy](../academy/README.md) — do básico ao deploy em produção
