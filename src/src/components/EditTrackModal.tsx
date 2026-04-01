import { useState } from 'react'
import { patchTrack, type ApiTrack } from '../lib/api'

type Props = {
  track: ApiTrack | null
  open: boolean
  onClose: () => void
  onSaved: (t: ApiTrack) => void
}

export function EditTrackModal({ track, open, onClose, onSaved }: Props) {
  if (!open || !track) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="edit-track-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#2d2d2d] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-white"
          aria-label="Fechar"
        >
          ✕
        </button>
        <h2 id="edit-track-title" className="mb-4 text-lg font-semibold text-white">
          Editar faixa
        </h2>
        <TrackForm key={track.id} track={track} onClose={onClose} onSaved={onSaved} />
      </div>
    </div>
  )
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function TrackForm({
  track,
  onClose,
  onSaved,
}: {
  track: ApiTrack
  onClose: () => void
  onSaved: (t: ApiTrack) => void
}) {
  const [title, setTitle] = useState(track.title)
  const [trackNumberStr, setTrackNumberStr] = useState(
    track.trackNumber != null ? String(track.trackNumber) : '',
  )
  const [discNumberStr, setDiscNumberStr] = useState(
    track.discNumber != null ? String(track.discNumber) : '',
  )
  const [artistName, setArtistName] = useState(track.artistName)
  const [albumName, setAlbumName] = useState(track.albumTitle)
  const [albumYearStr, setAlbumYearStr] = useState(
    track.albumYear != null ? String(track.albumYear) : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const yearParsed = parseOptionalInt(albumYearStr)
    if (albumYearStr.trim() !== '' && (yearParsed == null || yearParsed < 1000 || yearParsed > 9999)) {
      setError('Indique um ano válido (1000–9999) ou deixe em branco.')
      setSaving(false)
      return
    }
    const discParsed = parseOptionalInt(discNumberStr)
    if (discNumberStr.trim() !== '' && (discParsed == null || discParsed < 1)) {
      setError('Número do disco: use 1 ou superior, ou deixe em branco.')
      setSaving(false)
      return
    }
    try {
      const updated = (await patchTrack(track.id, {
        title: title.trim(),
        trackNumber: parseOptionalInt(trackNumberStr),
        discNumber: discParsed,
        artistName: artistName.trim(),
        albumName: albumName.trim(),
        albumYear: yearParsed,
      })) as ApiTrack
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <label className="block text-sm">
        <span className="text-gray-400">Título</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-white focus:border-[#60cdff]/50 focus:outline-none"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-gray-400">Número do disco</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Ex.: 1 ou 2"
            value={discNumberStr}
            onChange={(e) => setDiscNumberStr(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-white placeholder:text-gray-600 focus:border-[#60cdff]/50 focus:outline-none"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Volume do álbum (útil em discos duplos). Em branco se for um só disco.
          </span>
        </label>
        <label className="block text-sm">
          <span className="text-gray-400">Número da faixa</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Ex.: 3"
            value={trackNumberStr}
            onChange={(e) => setTrackNumberStr(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-white placeholder:text-gray-600 focus:border-[#60cdff]/50 focus:outline-none"
          />
          <span className="mt-1 block text-xs text-gray-500">Posição no disco. Em branco para sem número.</span>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-gray-400">Artista do álbum</span>
        <input
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-white focus:border-[#60cdff]/50 focus:outline-none"
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-400">Álbum</span>
        <input
          value={albumName}
          onChange={(e) => setAlbumName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-white focus:border-[#60cdff]/50 focus:outline-none"
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-400">Ano do álbum</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ex.: 2020"
          value={albumYearStr}
          onChange={(e) => setAlbumYearStr(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-white placeholder:text-gray-600 focus:border-[#60cdff]/50 focus:outline-none"
        />
        <span className="mt-1 block text-xs text-gray-500">Ano de lançamento do álbum; em branco para limpar.</span>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-white/10"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#60cdff]/90 px-4 py-2 text-sm font-medium text-[#0a0a0a] hover:bg-[#60cdff] disabled:opacity-50"
        >
          {saving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
