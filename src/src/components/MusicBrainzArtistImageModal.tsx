import { useCallback, useEffect, useState } from 'react'
import {
  applyArtistImageFromMusicBrainz,
  searchMusicBrainzArtists,
  type MbArtistHit,
} from '../lib/api'

type Props = {
  open: boolean
  artistId: number
  artistName: string
  onClose: () => void
  onSuccess: () => void
}

export function MusicBrainzArtistImageModal({
  open,
  artistId,
  artistName,
  onClose,
  onSuccess,
}: Props) {
  const [q, setQ] = useState(artistName)
  const [hits, setHits] = useState<MbArtistHit[]>([])
  const [loading, setLoading] = useState(false)
  const [applyingMbid, setApplyingMbid] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const runSearch = useCallback(async (query: string) => {
    const t = query.trim()
    if (t.length < 1) {
      setHits([])
      return
    }
    setLoading(true)
    setErr(null)
    try {
      setHits(await searchMusicBrainzArtists(t))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro na pesquisa')
      setHits([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQ(artistName)
    setErr(null)
    void runSearch(artistName)
  }, [open, artistName, runSearch])

  async function onPick(hit: MbArtistHit) {
    setApplyingMbid(hit.mbid)
    setErr(null)
    try {
      await applyArtistImageFromMusicBrainz(artistId, hit.mbid, hit.name)
      onSuccess()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível obter a imagem')
    } finally {
      setApplyingMbid(null)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mb-artist-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-[#2d2d2d] shadow-2xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 id="mb-artist-modal-title" className="text-lg font-semibold text-white">
            Imagem a partir do MusicBrainz
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Escolha o artista correto na base MusicBrainz. A foto vem do Fanart.tv (se configurar a
            chave API) ou do TheAudioDB — o MusicBrainz não fornece ficheiros de imagem.
          </p>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSearch(q)
              }}
              placeholder="Pesquisar…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[#60cdff]/50 focus:outline-none focus:ring-1 focus:ring-[#60cdff]/40"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void runSearch(q)}
              className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
            >
              {loading ? '…' : 'Pesquisar'}
            </button>
          </div>

          {err && <p className="text-sm text-red-400">{err}</p>}

          <ul className="max-h-[45vh] overflow-y-auto rounded-xl border border-white/5 bg-[#1f1f1f]/80">
            {loading && hits.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-gray-500">A pesquisar…</li>
            )}
            {!loading && hits.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-gray-500">
                Nenhum resultado. Tente outro termo.
              </li>
            )}
            {hits.map((h) => (
              <li key={h.mbid} className="border-b border-white/5 last:border-0">
                <button
                  type="button"
                  disabled={applyingMbid != null}
                  onClick={() => void onPick(h)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-3 text-left text-sm transition hover:bg-white/5 disabled:opacity-50"
                >
                  <span className="font-medium text-white">{h.name}</span>
                  {h.disambiguation ? (
                    <span className="text-xs text-gray-500">{h.disambiguation}</span>
                  ) : null}
                  <span className="font-mono text-[10px] text-gray-600">{h.mbid}</span>
                  {applyingMbid === h.mbid && (
                    <span className="text-xs text-[#60cdff]">A obter imagem…</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
