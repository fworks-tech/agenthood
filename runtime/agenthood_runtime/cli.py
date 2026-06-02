"""agenthood-run CLI — Phase 1: invoke a single member against a task."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import click
from dotenv import load_dotenv


def _load_env() -> None:
    """Load .env from the agenthood repo root or the current directory."""
    agenthood_root = os.environ.get("AGENTHOOD_ROOT")
    if agenthood_root:
        load_dotenv(Path(agenthood_root) / ".env", override=False)
    load_dotenv(override=False)


@click.group()
@click.version_option(package_name="agenthood-runtime")
def cli() -> None:
    """Agenthood autonomous runtime — execute Society members as real LLM agents."""
    _load_env()


# ---------------------------------------------------------------------------
# agenthood-run list
# ---------------------------------------------------------------------------


@cli.command("list")
def list_members() -> None:
    """List all available Society members."""
    from agenthood_runtime.members.registry import MemberRegistry

    try:
        registry = MemberRegistry()
    except RuntimeError as exc:
        click.echo(f"Error: {exc}", err=True)
        sys.exit(1)

    click.echo("Available Society members:")
    for name in registry.names():
        spec = registry.get(name)
        click.echo(f"  {name:20s}  {spec.get('description', '')[:70]}")


# ---------------------------------------------------------------------------
# agenthood-run invoke <member> <task>
# ---------------------------------------------------------------------------


@cli.command("invoke")
@click.argument("member")
@click.argument("task")
@click.option(
    "--thread-id",
    default=None,
    help="LangGraph thread ID for resumable sessions. Auto-generated if omitted.",
)
@click.option(
    "--stream/--no-stream",
    default=True,
    help="Stream output tokens as they are generated.",
)
def invoke(member: str, task: str, thread_id: str | None, stream: bool) -> None:
    """Invoke MEMBER to perform TASK.

    Example:
        agenthood-run invoke the-scribe "write a commit message for the current diff"
    """
    asyncio.run(_invoke_async(member, task, thread_id, stream))


async def _invoke_async(
    member_name: str, task: str, thread_id: str | None, stream: bool
) -> None:
    import uuid

    from agenthood_runtime.members.registry import MemberRegistry

    thread_id = thread_id or str(uuid.uuid4())

    try:
        registry = MemberRegistry()
    except (RuntimeError, FileNotFoundError) as exc:
        click.echo(f"Error initialising registry: {exc}", err=True)
        sys.exit(1)

    try:
        spec = registry.get(member_name)
    except KeyError as exc:
        click.echo(str(exc), err=True)
        sys.exit(1)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        click.echo(
            "Error: ANTHROPIC_API_KEY is not set. "
            "Add it to your .env file or export it in your shell.",
            err=True,
        )
        sys.exit(1)

    click.echo(
        f"[agenthood-run] Invoking {member_name} | thread={thread_id}",
        err=True,
    )
    click.echo(f"[agenthood-run] Task: {task}", err=True)
    click.echo("─" * 60, err=True)

    try:
        from deepagents import create_deep_agent  # type: ignore[import]
        from langchain_anthropic import ChatAnthropic  # type: ignore[import]
        from langgraph.checkpoint.memory import MemorySaver  # type: ignore[import]
    except ImportError as exc:
        click.echo(
            f"Error: missing dependency — {exc}. "
            "Run: pip install agenthood-runtime",
            err=True,
        )
        sys.exit(1)

    llm = ChatAnthropic(model=spec.get("model", "claude-sonnet-4-6"), api_key=api_key)  # type: ignore[call-arg]
    checkpointer = MemorySaver()

    agent = create_deep_agent(
        spec=spec,
        llm=llm,
        checkpointer=checkpointer,
    )

    config = {"configurable": {"thread_id": thread_id}}

    if stream:
        async for chunk in agent.astream({"messages": [("human", task)]}, config=config):
            if "messages" in chunk:
                for msg in chunk["messages"]:
                    if hasattr(msg, "content") and msg.content:
                        click.echo(msg.content, nl=False)
        click.echo()
    else:
        result = await agent.ainvoke({"messages": [("human", task)]}, config=config)
        messages = result.get("messages", [])
        if messages:
            last = messages[-1]
            click.echo(last.content if hasattr(last, "content") else str(last))
