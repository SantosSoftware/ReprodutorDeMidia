import { useCallback, useEffect, useState } from 'react'
import { EditTrackModal } from '../components/EditTrackModal'
import { fetchTracks, type ApiTrack } from '../lib/api'
import { formatDuration } from '../lib/format'
import { usePlaybackStore } from '../stores/playbackStore'

export function SongsPage() {
  const [tracks, setTracks] = useState<ApiTrack[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editTrack, setEditTrack] = useState<ApiTrack | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const playQueueFromApi = usePlaybackStore((s) => s.playQueueFromApi)

  const load = useCallback(async () => {
    setError(null)
    try {
      setTracks(await fetchTracks())
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
      <h2 className="mb-6 text-2xl font-semibold tracking-tight text-white">Músicas</h2>
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-[#252525]/80">
        {tracks.map((t, i) => (
          <li
            key={t.id}
            className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5"
          >
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
        <p className="text-sm text-gray-500">Nenhuma faixa na biblioteca.</p>
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
