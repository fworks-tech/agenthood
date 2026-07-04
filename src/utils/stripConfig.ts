export function stripConfig(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !k.startsWith('_comment'))
      .map(([k, v]) => [
        k,
        v && typeof v === 'object' && !Array.isArray(v)
          ? stripConfig(v as Record<string, unknown>)
          : v,
      ]),
  )
}
