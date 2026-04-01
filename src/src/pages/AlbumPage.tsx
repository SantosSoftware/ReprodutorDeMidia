import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EditAlbumMetadataModal } from '../components/EditAlbumMetadataModal'
import { EditTrackModal } from '../components/EditTrackModal'
import { fetchAlbum, fetchTracks, uploadAlbumCover, type ApiAlbum, type ApiTrack } from '../lib/api'
import { formatDuration } from '../lib/format'
import { usePlaybackStore } from '../stores/playbackStore'

export function AlbumPage() {
  const { id } = useParams<{ id: string }>()
  const albumId = Number(id)
  const [album, setAlbum] = useState<ApiAlbum | null>(null)
  const [tracks, setTracks] = useState<ApiTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [editTrack, setEditTrack] = useState<ApiTrack | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [metaModalOpen, setMetaModalOpen] = useState(false)

  const playQueueFromApi = usePlaybackStore((s) => s.playQueueFromApi)

  const load = useCallback(async () => {
    if (Number.isNaN(albumId)) {
      setError('Álbum inválido')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [a, t] = await Promise.all([fetchAlbum(albumId), fetchTracks(albumId)])
      setAlbum(a)
      setTracks(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [albumId])

  useEffect(() => {
    void load()
  }, [load])

  async function onCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !album) return
    setCoverUploading(true)
    try {
      const { coverUrl } = await uploadAlbumCover(album.id, file)
      setAlbum((prev) => (prev ? { ...prev, coverUrl } : prev))
    } finally {
      setCoverUploading(false)
      e.target.value = ''
    }
  }

  function playAll() {
    if (tracks.length === 0) return
    playQueueFromApi(tracks, 0, album?.coverUrl ?? null)
  }

  function playTrack(index: number) {
    playQueueFromApi(tracks, index, album?.coverUrl ?? null)
  }

  if (loading) {
    return <p className="text-sm text-gray-500">A carregar…</p>
  }
  if (error || !album) {
    return (
      <p className="text-sm text-red-400">
        {error ?? 'Álbum não encontrado.'}{' '}
        <Link to="/" className="text-[#60cdff] hover:underline">
          Voltar
        </Link>
      </p>
    )
  }

  return (
    <div>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-[#60cdff] hover:underline"
      >
        ← Biblioteca
      </Link>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="shrink-0 lg:w-56">
          <div className="group relative aspect-square overflow-hidden rounded-2xl bg-[#2d2d2d] shadow-lg ring-1 ring-white/10">
            {album.coverUrl ? (
              <img src={album.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-6xl text-white/20">
                ♪
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10">
              <button
                type="button"
                onClick={() => setMetaModalOpen(true)}
                className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25"
              >
                Metadados do álbum
              </button>
            </div>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs text-gray-500">Capa do álbum</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => void onCoverFile(e)}
              disabled={coverUploading}
              className="w-full text-xs text-gray-400 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white"
            />
          </label>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-white">{album.title}</h1>
          <p className="mt-1 text-gray-400">
            {album.artistName}
            {album.year != null && (
              <span className="text-gray-500"> · {album.year}</span>
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <button
              type="button"
              onClick={playAll}
              disabled={tracks.length === 0}
              className="rounded-xl bg-[#60cdff]/90 px-5 py-2 text-sm font-medium text-[#0a0a0a] hover:bg-[#60cdff] disabled:opacity-40"
            >
              Reproduzir álbum
            </button>
          </div>

          <h2 className="mt-10 text-sm font-medium uppercase tracking-wider text-gray-500">
            Faixas
          </h2>
          <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 bg-[#252525]/80">
            {tracks.map((t, i) => (
              <li
                key={t.id}
                className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5"
              >
                <span className="w-16 shrink-0 text-center text-xs tabular-nums text-gray-600">
                  {t.discNumber != null && (
                    <span className="text-gray-500">{t.discNumber}·</span>
                  )}
                  {t.trackNumber ?? i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => playTrack(i)}
                  title="Reproduzir"
                  aria-label={`Reproduzir ${t.title}`}
                  className="shrink-0 rounded-full p-1.5 text-[#60cdff] hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60cdff]/40"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => playTrack(i)}
                  className="min-w-0 flex-1 truncate text-left text-gray-200 hover:text-white"
                >
                  {t.title}
                </button>
                <span className="shrink-0 text-xs tabular-nums text-gray-500">
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
          {tracks.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">Este álbum não tem faixas.</p>
          )}
        </div>
      </div>

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

      <EditAlbumMetadataModal
        album={album}
        open={metaModalOpen}
        onClose={() => setMetaModalOpen(false)}
        onSaved={() => {
          void load()
        }}
      />
    </div>
  )
}
