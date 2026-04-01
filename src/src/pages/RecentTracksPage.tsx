import { useCallback, useEffect, useState } from 'react'
import { EditTrackModal } from '../components/EditTrackModal'
import { fetchRecentTracks, type ApiTrack } from '../lib/api'
import { formatDuration, formatPlayedAt } from '../lib/format'
import { usePlaybackStore } from '../stores/playbackStore'

export function RecentTracksPage() {
  const [tracks, setTracks] = useState<ApiTrack[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editTrack, setEditTrack] = useState<ApiTrack | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const playQueueFromApi = usePlaybackStore((s) => s.playQueueFromApi)

  const load = useCallback(async () => {
    setError(null)
    try {
      setTracks(await fetchRecentTracks(50))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function playAt(index: number) {
    if (tracks.length === 0) return
    playQueueFromApi(tracks, index, null)
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold tracking-tight text-white">Últimas reproduções</h2>
      <p className="mb-6 max-w-xl text-sm text-gray-500">
        Até 50 faixas, da mais recentemente ouvida à mais antiga. Cada entrada conta quando a música
        toca mais de 15 segundos (ou a faixa inteira se for mais curta que 15 s). A mesma música pode
        aparecer várias vezes se for ouvida em momentos diferentes.
      </p>
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-[#252525]/80">
        {tracks.map((t, i) => (
          <li
            key={t.historyId ?? `${t.id}-${i}-${t.playedAt ?? ''}`}
            className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5"
          >
            <span className="w-10 shrink-0 text-center text-xs text-gray-500">{i + 1}</span>
            <button
              type="button"
              onClick={() => playAt(i)}
              className="min-w-0 flex-1 truncate text-left text-gray-200 hover:text-white"
            >
              <span className="font-medium">{t.title}</span>
              <span className="ml-2 text-xs text-gray-500">
                {t.artistName} — {t.albumTitle}
              </span>
            </button>
            {t.playedAt != null && (
              <span className="hidden shrink-0 text-xs tabular-nums text-gray-500 sm:inline">
                {formatPlayedAt(t.playedAt)}
              </span>
            )}
            <span className="text-xs tabular-nums text-gray-500">
              {formatDuration(t.durationSeconds)}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditTrack(t)
                setModalOpen(true)
              }}
              className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#60cdff] hover:bg-white/10"
            >
              Editar
            </button>
          </li>
        ))}
      </ul>
      {tracks.length === 0 && !error && (
        <p className="text-sm text-gray-500">
          Ainda não há histórico. Ouça músicas (mais de 15 segundos ou até ao fim se forem curtas) para
          aparecerem aqui por ordem de reprodução.
        </p>
      )}

      <EditTrackModal
        track={editTrack}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditTrack(null)
        }}
        onSaved={() => {
          void load()
        }}
      />
    </div>
  )
}
