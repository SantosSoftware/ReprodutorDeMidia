import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAlbums, fetchAlbumsByArtist, type ApiAlbum } from '../lib/api'

type Props = {
  /** Se definido, carrega apenas os álbuns deste artista. */
  artistId?: number
  /** Mensagem quando não há álbuns (lista vazia). */
  emptyLabel?: string
}

export function AlbumGrid({ artistId, emptyLabel }: Props) {
  const [albums, setAlbums] = useState<ApiAlbum[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      if (artistId != null) {
        setAlbums(await fetchAlbumsByArtist(artistId))
      } else {
        setAlbums(await fetchAlbums())
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    }
  }, [artistId])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </p>
    )
  }

  const defaultEmpty =
    artistId != null
      ? 'Este artista ainda não tem álbuns na biblioteca.'
      : 'Nenhum álbum na biblioteca. Importe uma pasta de música para começar.'

  if (albums.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-gray-500">
        {emptyLabel ?? defaultEmpty}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {albums.map((a) => (
        <Link
          key={a.id}
          to={`/album/${a.id}`}
          className="group rounded-2xl bg-[#2d2d2d]/60 p-2 shadow-lg ring-1 ring-white/5 transition hover:bg-[#353535] hover:ring-white/10"
        >
          <div className="aspect-square overflow-hidden rounded-xl bg-[#1a1a1a] shadow-inner ring-1 ring-black/20">
            {a.coverUrl ? (
              <img
                src={a.coverUrl}
                alt=""
                className="h-full w-full object-cover transition group-hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl text-white/20">
                ♪
              </div>
            )}
          </div>
          <p className="mt-2 truncate px-1 text-sm font-medium text-white">{a.title}</p>
          <p className="truncate px-1 text-xs text-gray-500">{a.artistName}</p>
        </Link>
      ))}
    </div>
  )
}
