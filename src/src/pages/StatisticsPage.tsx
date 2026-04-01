import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchStatsTopAlbums,
  fetchStatsTopArtists,
  fetchTopTracks,
  type ApiTrack,
  type StatAlbumRow,
  type StatArtistRow,
} from '../lib/api'

const LIST_LIMIT = 10

function playsLabel(n: number): string {
  return n === 1 ? '1 reprodução' : `${n} reproduções`
}

function AvatarCircle({
  src,
  alt,
  square,
}: {
  src: string | null
  alt: string
  square?: boolean
}) {
  const rounded = square ? 'rounded-lg' : 'rounded-full'
  return (
    <div
      className={`h-14 w-14 shrink-0 overflow-hidden bg-zinc-800/90 ring-1 ring-white/10 ${rounded}`}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xl text-white/25">♪</div>
      )}
    </div>
  )
}

export function StatisticsPage() {
  const navigate = useNavigate()
  const [artists, setArtists] = useState<StatArtistRow[]>([])
  const [albums, setAlbums] = useState<StatAlbumRow[]>([])
  const [tracks, setTracks] = useState<ApiTrack[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [a, al, tr] = await Promise.all([
        fetchStatsTopArtists(LIST_LIMIT),
        fetchStatsTopAlbums(LIST_LIMIT),
        fetchTopTracks(LIST_LIMIT),
      ])
      setArtists(a)
      setAlbums(al)
      setTracks(tr)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar estatísticas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-lg pb-10">
      <h2 className="mb-1 text-2xl font-semibold tracking-tight text-white">Estatísticas</h2>
      <p className="mb-8 text-sm text-gray-500">
        Com base nas reproduções contadas (≥15 s de audição ou faixa completa se for mais curta).
      </p>

      {loading && <p className="text-sm text-gray-500">A carregar…</p>}
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <>
          <section className="mb-10">
            <h3 className="mb-4 text-center text-[17px] font-semibold tracking-tight text-white">
              Os seus artistas mais ouvidos
            </h3>
            {artists.length === 0 ? (
              <p className="text-center text-sm text-gray-500">Ainda sem reproduções por artista.</p>
            ) : (
              <div className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#262030] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                {artists.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(`/artist/${r.id}`)}
                    className="flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-4 text-left transition hover:bg-white/[0.04] last:border-b-0"
                  >
                    <span className="w-8 shrink-0 text-center text-[15px] font-medium tabular-nums text-white/90">
                      {i + 1}
                    </span>
                    <AvatarCircle src={r.imageUrl} alt={r.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{r.name}</p>
                      <p className="truncate text-sm text-gray-500">{playsLabel(r.playCount)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="mb-10">
            <h3 className="mb-4 text-center text-[17px] font-semibold tracking-tight text-white">
              Os seus álbuns mais ouvidos
            </h3>
            {albums.length === 0 ? (
              <p className="text-center text-sm text-gray-500">Ainda sem reproduções por álbum.</p>
            ) : (
              <div className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#262030] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                {albums.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(`/album/${r.id}`)}
                    className="flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-4 text-left transition hover:bg-white/[0.04] last:border-b-0"
                  >
                    <span className="w-8 shrink-0 text-center text-[15px] font-medium tabular-nums text-white/90">
                      {i + 1}
                    </span>
                    <AvatarCircle src={r.coverUrl} alt={r.title} square />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{r.title}</p>
                      <p className="truncate text-sm text-gray-500">
                        {r.artistName} · {playsLabel(r.playCount)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="mb-10">
            <h3 className="mb-4 text-center text-[17px] font-semibold tracking-tight text-white">
              As suas músicas mais ouvidas
            </h3>
            {tracks.length === 0 ? (
              <p className="text-center text-sm text-gray-500">Ainda sem reproduções por faixa.</p>
            ) : (
              <div className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#262030] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                {tracks.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigate(`/album/${t.albumId}`)}
                    className="flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-4 text-left transition hover:bg-white/[0.04] last:border-b-0"
                  >
                    <span className="w-8 shrink-0 text-center text-[15px] font-medium tabular-nums text-white/90">
                      {i + 1}
                    </span>
                    <AvatarCircle src={t.albumCoverUrl} alt={t.title} square />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{t.title}</p>
                      <p className="truncate text-sm text-gray-500">
                        {t.artistName} · {playsLabel(t.playCount)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="mt-2 flex flex-col gap-3">
            <Link
              to="/"
              className="block w-full rounded-xl bg-[#1e1c24] py-3.5 text-center text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-[#252230]"
            >
              Ir para a biblioteca
            </Link>
            <Link
              to="/playlists/top-50"
              className="block w-full rounded-xl py-3 text-center text-sm font-medium text-[#60cdff] hover:underline"
            >
              Ver playlist do top de músicas
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
