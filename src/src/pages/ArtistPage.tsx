import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlbumGrid } from '../components/AlbumGrid'
import { MusicBrainzArtistImageModal } from '../components/MusicBrainzArtistImageModal'
import { fetchArtist, fetchTracksByArtist, uploadArtistImage } from '../lib/api'
import type { ApiArtist } from '../lib/api'
import { shuffleInPlace } from '../lib/shuffle'
import { usePlaybackStore } from '../stores/playbackStore'

export function ArtistPage() {
  const { id } = useParams<{ id: string }>()
  const artistId = Number(id)
  const [artist, setArtist] = useState<ApiArtist | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [playBusy, setPlayBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [mbModalOpen, setMbModalOpen] = useState(false)

  const playQueueFromApi = usePlaybackStore((s) => s.playQueueFromApi)

  const load = useCallback(async () => {
    if (Number.isNaN(artistId)) {
      setError('Artista inválido')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setArtist(await fetchArtist(artistId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
      setArtist(null)
    } finally {
      setLoading(false)
    }
  }, [artistId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => setHint(null), 3500)
    return () => window.clearTimeout(t)
  }, [hint])

  async function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !artist) return
    setUploading(true)
    try {
      const { imageUrl } = await uploadArtistImage(artist.id, file)
      setArtist((prev) => (prev ? { ...prev, imageUrl } : prev))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function playInOrder() {
    if (!artist) return
    setPlayBusy(true)
    try {
      const tracks = await fetchTracksByArtist(artist.id)
      if (tracks.length === 0) {
        setHint('Nenhuma música deste artista na biblioteca.')
        return
      }
      playQueueFromApi(tracks, 0)
    } catch {
      setHint('Não foi possível carregar as faixas.')
    } finally {
      setPlayBusy(false)
    }
  }

  async function playShuffled() {
    if (!artist) return
    setPlayBusy(true)
    try {
      const tracks = await fetchTracksByArtist(artist.id)
      if (tracks.length === 0) {
        setHint('Nenhuma música deste artista na biblioteca.')
        return
      }
      const copy = [...tracks]
      shuffleInPlace(copy)
      playQueueFromApi(copy, 0)
    } catch {
      setHint('Não foi possível carregar as faixas.')
    } finally {
      setPlayBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">A carregar…</p>
  }
  if (error || !artist) {
    return (
      <p className="text-sm text-red-400">
        {error ?? 'Artista não encontrado.'}{' '}
        <Link to="/artists" className="text-[#60cdff] hover:underline">
          Voltar aos artistas
        </Link>
      </p>
    )
  }

  return (
    <div>
      <Link
        to="/artists"
        className="mb-6 inline-flex items-center gap-1 text-sm text-[#60cdff] hover:underline"
      >
        ← Artistas
      </Link>

      {hint && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {hint}
        </p>
      )}

      <MusicBrainzArtistImageModal
        open={mbModalOpen}
        artistId={artist.id}
        artistName={artist.name}
        onClose={() => setMbModalOpen(false)}
        onSuccess={() => void load()}
      />

      <header className="mb-10 flex flex-col gap-8 sm:flex-row sm:items-end">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <div className="relative aspect-square w-[min(100%,280px)] overflow-hidden rounded-2xl bg-[#2d2d2d] shadow-2xl ring-1 ring-white/10 sm:w-56">
            {artist.imageUrl ? (
              <img
                src={artist.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#3d3d3d] to-[#1a1a1a] text-7xl text-white/25">
                ♪
              </div>
            )}

            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/35 to-transparent p-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={playBusy}
                  onClick={() => void playInOrder()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/95 py-2.5 text-xs font-semibold text-[#111] shadow-lg transition hover:bg-white disabled:opacity-50"
                  title="Todas as músicas por álbum e ordem das faixas"
                >
                  <IconListOrdered className="h-4 w-4 shrink-0" />
                  Sequência
                </button>
                <button
                  type="button"
                  disabled={playBusy}
                  onClick={() => void playShuffled()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/20 py-2.5 text-xs font-semibold text-white shadow-lg ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-white/30 disabled:opacity-50"
                  title="Todas as músicas numa ordem aleatória"
                >
                  <IconShuffle className="h-4 w-4 shrink-0" />
                  Aleatório
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <label className="block">
              <span className="sr-only">Imagem do artista</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => void onImageFile(e)}
                disabled={uploading}
                className="w-full cursor-pointer text-xs text-gray-400 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-white"
              />
            </label>
            <button
              type="button"
              disabled={uploading}
              onClick={() => setMbModalOpen(true)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-center text-xs font-medium text-[#60cdff] transition hover:bg-white/10 disabled:opacity-50"
            >
              MusicBrainz — escolher artista e obter imagem
            </button>
          </div>
          {uploading && (
            <p className="mt-1 text-xs text-gray-500">A enviar imagem…</p>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Artista</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {artist.name}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {artist.albumCount} {artist.albumCount === 1 ? 'álbum' : 'álbuns'}
          </p>
        </div>
      </header>

      <AlbumGrid artistId={artist.id} />
    </div>
  )
}

function IconListOrdered({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
    </svg>
  )
}

function IconShuffle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
    </svg>
  )
}
