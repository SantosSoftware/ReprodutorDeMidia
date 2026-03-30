import { useEffect, useState } from 'react'
import {
  fetchLibraryConfig,
  putLibraryConfig,
  syncLibrary,
} from '../lib/api'

type Props = {
  onImported: () => void
}

export function ImportSection({ onImported }: Props) {
  const [path, setPath] = useState('')
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchLibraryConfig()
      .then((c) => setPath(c.musicPath ?? ''))
      .catch(() => {})
      .finally(() => setLoadingConfig(false))
  }, [])

  async function handleSavePath() {
    if (!path.trim()) {
      setError('Indique o caminho completo da pasta (ex.: C:\\Música)')
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const c = await putLibraryConfig(path.trim())
      setPath(c.musicPath ?? path.trim())
      setMessage('Pasta da biblioteca guardada. Pode usar «Atualizar biblioteca» quando quiser.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setError(null)
    setMessage(null)
    try {
      const r = await syncLibrary()
      if (r.errors.some((x) => x.includes('Defina primeiro'))) {
        setError('Guarde primeiro a pasta da biblioteca antes de atualizar.')
        return
      }
      const parts = [
        `${r.filesScanned} ficheiros de áudio analisados.`,
        `+${r.tracksAdded} novas, ${r.tracksUpdated} atualizadas, −${r.tracksRemoved} removidas.`,
      ]
      if (r.errors.length > 0) {
        parts.push(
          `Avisos (${r.errors.length}): ${r.errors.slice(0, 3).join(' · ')}${r.errors.length > 3 ? '…' : ''}`,
        )
      }
      setMessage(parts.join(' '))
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sincronização falhou')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-white/10 bg-[#252525]/80 p-5 shadow-lg backdrop-blur-sm">
      <h2 className="text-sm font-semibold text-white">Pasta da biblioteca</h2>
      <p className="mt-1 text-xs text-gray-500">
        Indique uma vez o diretório onde estão as suas músicas. Depois use apenas
        &quot;Atualizar biblioteca&quot; para incorporar ficheiros novos, aplicar alterações nas
        etiquetas e remover faixas cujos ficheiros já não existam nessa pasta.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Caminho da pasta</span>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            disabled={loadingConfig}
            placeholder="C:\Users\...\Música"
            className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-[#60cdff]/50 focus:outline-none focus:ring-1 focus:ring-[#60cdff]/30 disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleSavePath()}
          disabled={saving || loadingConfig}
          className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
        >
          {saving ? 'A guardar…' : 'Guardar pasta'}
        </button>
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={syncing || loadingConfig}
          className="w-full rounded-xl bg-[#60cdff]/90 px-5 py-3 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#60cdff] disabled:opacity-50 sm:w-auto"
        >
          {syncing ? 'A atualizar biblioteca…' : 'Atualizar biblioteca'}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {message && <p className="mt-3 text-sm text-emerald-400/90">{message}</p>}
    </section>
  )
}
