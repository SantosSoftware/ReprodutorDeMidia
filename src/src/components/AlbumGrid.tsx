import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAlbums, fetchAlbumsByArtist, type ApiAlbum } from '../lib/api'

const ARTIST_ALBUM_SORT_KEY = 'auralis.artistAlbumSort'

export type ArtistAlbumSort = 'year' | 'title'

function loadArtistAlbumSort(): ArtistAlbumSort {
  try {
    const v = localStorage.getItem(ARTIST_ALBUM_SORT_KEY)
    if (v === 'year' || v === 'title') return v
  } catch {
    /* ignore */
  }
  return 'title'
}

function persistArtistAlbumSort(sort: ArtistAlbumSort): void {
  try {
    localStorage.setItem(ARTIST_ALBUM_SORT_KEY, sort)
  } catch {
    /* ignore */
  }
}

function sortAlbumsForArtist(list: ApiAlbum[], sort: ArtistAlbumSort): ApiAlbum[] {
  const copy = [...list]
  if (sort === 'title') {
    copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    return copy
  }
  copy.sort((a, b) => {
    const ya = a.year ?? null
    const yb = b.year ?? null
    if (ya == null && yb == null) {
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    }
    if (ya == null) return 1
    if (yb == null) return -1
    if (ya !== yb) return ya - yb
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  })
  return copy
}

type Props = {
  /** Se definido, carrega apenas os álbuns deste artista. */
  artistId?: number
  /** Mensagem quando não há álbuns (lista vazia). */
  emptyLabel?: string
}

export function AlbumGrid({ artistId, emptyLabel }: Props) {
  const [albums, setAlbums] = useState<ApiAlbum[]>([])
  const [error, setError] = useState<string | null>(null)
  const [artistSort, setArtistSort] = useState<ArtistAlbumSort>(loadArtistAlbumSort)

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

  const displayAlbums = useMemo(() => {
    if (artistId == null) return albums
    return sortAlbumsForArtist(albums, artistSort)
  }, [albums, artistId, artistSort])

  function setSort(next: ArtistAlbumSort) {
    setArtistSort(next)
    persistArtistAlbumSort(next)
  }

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
    <>
      {artistId != null && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium text-gray-300">Álbuns</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Ordenar</span>
            <div className="inline-flex rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
              <button
                type="button"
                onClick={() => setSort('year')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  artistSort === 'year'
                    ? 'bg-[#60cdff]/20 text-[#60cdff]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Cronologia
              </button>
              <button
                type="button"
                onClick={() => setSort('title')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  artistSort === 'title'
                    ? 'bg-[#60cdff]/20 text-[#60cdff]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Título
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {displayAlbums.map((a) => (
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
            <p className="truncate px-1 text-xs text-gray-500">
              {a.year != null ? `${a.year} · ` : ''}
              {a.artistName}
            </p>
          </Link>
        ))}
      </div>
    </>
  )
}
