// Process-wide graceful-shutdown signal shared between the CLI run command and
// the reasoning loop. run.ts flips it on SIGINT/SIGTERM; ReActLoop polls it at
// each step boundary so the in-flight LLM/tool step finishes before the loop
// stops and flushes its trace. Kept as module state because the loop is not
// reachable from the command layer (it is constructed deep inside MemberRunner).
let requested = false

export function requestShutdown(): void {
  requested = true
}

export function isShutdownRequested(): boolean {
  return requested
}

export function resetShutdown(): void {
  requested = false
}
