export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Formata datetime vindo do SQLite (`YYYY-MM-DD HH:MM:SS`) para exibição local. */
export function formatPlayedAt(sqliteDatetime: string): string {
  const normalized = sqliteDatetime.includes('T') ? sqliteDatetime : sqliteDatetime.replace(' ', 'T')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return sqliteDatetime
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
