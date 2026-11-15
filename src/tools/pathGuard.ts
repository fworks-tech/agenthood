import { isAbsolute, relative, resolve } from 'node:path'
import { lstat, realpath } from 'node:fs/promises'

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
 * via `..` and via a symlink that points outside. The caller owns the error
 * message decision; a missing file is not a guard failure — the real read or
 * write surfaces it.
 */
export async function resolveInsideProject(root: string, path: string): Promise<GuardedPath> {
  const target = resolve(root, path)
  if (escapes(root, target)) {
    return { ok: false, error: `Path traversal denied: "${path}"` }
  }

  try {
    const stats = await lstat(target)
    if (stats.isSymbolicLink()) {
      const real = await realpath(target)
      if (escapes(root, real)) {
        return { ok: false, error: `Symlink traversal denied: "${path}" -> "${real}"` }
      }
    }
  } catch {
    // non-existent path: the caller's read/write reports the real error
  }

  return { ok: true, path: target }
}
