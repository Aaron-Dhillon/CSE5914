// Canonical categories = categories table names, slugified (see backend/utils/ticketMaster.py map_category)
export const CANONICAL_CATEGORIES = [
  'concerts', 'nightlife_djs', 'sports', 'musicals', 'plays_dance', 'comedy_shows', 'family_holiday', 'other'
]

export const CATEGORY_LABELS: Record<string, string> = {
  concerts: 'Concerts', nightlife_djs: 'Nightlife & DJs', sports: 'Sports', musicals: 'Musicals',
  plays_dance: 'Plays & Dance', comedy_shows: 'Comedy & Shows', family_holiday: 'Family & Holiday', other: 'Other',
}

const rawToCanonical: Record<string, string> = {}

export function mapCategory(raw?: string | null): string | null {
  if (!raw) return null

  // lowercase and trim
  const rawLower = String(raw).toLowerCase().trim()

  // normalized: replace any sequence of non-alphanumeric chars with single underscore,
  // collapse runs, trim leading/trailing underscores
  const normalized = rawLower
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!normalized) return null

  // 1) exact lookup on normalized raw value
  if (rawToCanonical[normalized]) return rawToCanonical[normalized]

  // 2) exact canonical match
  if (CANONICAL_CATEGORIES.includes(normalized)) return normalized

  // 3) tokenize and check tokens individually
  const tokens = normalized.split('_').filter(Boolean)
  for (const t of tokens) {
    if (rawToCanonical[t]) return rawToCanonical[t]
    if (CANONICAL_CATEGORIES.includes(t)) return t
  }

  // 4) substring fallback: check canonical names inside normalized string
  for (const c of CANONICAL_CATEGORIES) {
    if (normalized.includes(c)) return c
  }

  // 5) substring fallback against rawToCanonical keys (prefer longer keys first)
  const rawKeys = Object.keys(rawToCanonical).sort((a, b) => b.length - a.length)
  const compact = rawLower.replace(/[^a-z0-9]+/g, '')
  for (const k of rawKeys) {
    if (normalized.includes(k)) return rawToCanonical[k]
    const kCompact = k.replace(/_/g, '')
    if (kCompact && compact.includes(kCompact)) return rawToCanonical[k]
  }

  return null
}
