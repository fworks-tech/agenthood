import { isAbsolute, relative, resolve } from 'node:path'
import { realpath } from 'node:fs/promises'

export type GuardedPath =
  | { ok: true; path: string }
  | { ok: false; error: string }

/** A path escapes `root` when the relative form starts with `..` or is absolute
 *  (different drive on Windows). A plain `startsWith(root)` check lets a sibling
 *  folder that shares the prefix through — `proj-evil` for root `proj`. */
function escapes(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)
}

/**
 * Resolves a tool-supplied path inside the project root, rejecting traversal
 * via `..` and via a symlink that points outside. `allowedRoots` adds the
 * directories of skills activated in this run (#536) — read access only, and
 * every use is logged. The caller owns the error message decision; a missing
 * file is not a guard failure — the real read or write surfaces it.
 */
export async function resolveInsideProject(
  root: string,
  path: string,
  allowedRoots: Iterable<string> = [],
): Promise<GuardedPath> {
  const target = resolve(root, path)
  const projectRoot = resolve(root)
  const home = [projectRoot, ...Array.from(allowedRoots, (dir) => resolve(dir))].find((dir) => !escapes(dir, target))
  if (!home) {
    return { ok: false, error: `Path traversal denied: "${path}"` }
  }
  if (home !== projectRoot) console.log(`[skills] read allowed under activated skill: ${target}`)

  try {
    // realpath resolves every component, so a symlinked directory (docs -> /etc)
    // is caught too, not just a symlinked file.
    const real = await realpath(target)
    if (escapes(home, real)) {
      return { ok: false, error: `Symlink traversal denied: "${path}" -> "${real}"` }
    }
  } catch {
    // non-existent path: the caller's read/write reports the real error
  }

  return { ok: true, path: target }
}
