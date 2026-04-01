export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Formata datetime vindo do SQLite para a hora local do sistema.
 * O SQLite usa `datetime('now')` em UTC sem sufixo; sem `Z`, o `Date` do JS
 * interpretava mal — tratamos como UTC e convertemos para local.
 */
export function formatPlayedAt(sqliteDatetime: string): string {
  const trimmed = sqliteDatetime.trim()
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(normalized)
  const d = hasTz ? new Date(normalized) : new Date(`${normalized}Z`)
  if (Number.isNaN(d.getTime())) return sqliteDatetime
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
