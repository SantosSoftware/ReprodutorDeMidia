import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchArtists, uploadArtistImage, type ApiArtist } from '../lib/api'

export function ArtistsPage() {
  const [rows, setRows] = useState<ApiArtist[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await fetchArtists())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onImageChange(artistId: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingId(artistId)
    try {
      await uploadArtistImage(artistId, file)
      await load()
    } catch {
      /* feedback opcional */
    } finally {
      setUploadingId(null)
      e.target.value = ''
    }
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold tracking-tight text-white">Artistas</h2>
      <p className="mb-6 max-w-xl text-sm text-gray-500">
        Toque no nome ou na imagem para ver os álbuns. Use &quot;Carregar imagem&quot; para definir
        a foto do artista (formato quadrado, como no Spotify).
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {rows.map((a) => (
          <div
            key={a.id}
            className="flex flex-col rounded-2xl bg-[#2d2d2d]/50 p-3 ring-1 ring-white/5 transition hover:bg-[#323232]/80 hover:ring-white/10"
          >
            <Link to={`/artist/${a.id}`} className="group block">
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#1a1a1a] shadow-inner ring-1 ring-black/30">
                {a.imageUrl ? (
                  <img
                    src={a.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#353535] to-[#1f1f1f] text-5xl text-white/20">
                    ♪
                  </div>
                )}
              </div>
              <p className="mt-3 truncate text-center text-sm font-semibold text-white group-hover:text-[#60cdff]">
                {a.name}
              </p>
            </Link>
            <p className="mt-0.5 text-center text-xs text-gray-500">
              {a.albumCount} {a.albumCount === 1 ? 'álbum' : 'álbuns'}
            </p>
            <label className="mt-3 block cursor-pointer text-center">
              <span className="text-xs font-medium text-[#60cdff] hover:underline">
                {uploadingId === a.id ? 'A enviar…' : 'Carregar imagem'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={uploadingId != null}
                onChange={(e) => void onImageChange(a.id, e)}
                onClick={(ev) => ev.stopPropagation()}
              />
            </label>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="mt-8 text-sm text-gray-500">Nenhum artista na biblioteca.</p>
      )}
    </div>
  )
}
