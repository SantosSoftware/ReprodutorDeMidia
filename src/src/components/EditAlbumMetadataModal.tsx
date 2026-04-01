import { useState } from 'react'
import { patchAlbum, type ApiAlbum } from '../lib/api'

type Props = {
  album: ApiAlbum | null
  open: boolean
  onClose: () => void
  onSaved: (a: ApiAlbum) => void
}

function parseOptionalYear(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

export function EditAlbumMetadataModal({ album, open, onClose, onSaved }: Props) {
  if (!open || !album) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="edit-album-meta-title"
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
        <h2 id="edit-album-meta-title" className="mb-1 text-lg font-semibold text-white">
          Metadados do álbum
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          Aplica-se a todas as faixas deste álbum (nome, artista e ano na biblioteca).
        </p>
        <AlbumMetaForm key={album.id} album={album} onClose={onClose} onSaved={onSaved} />
      </div>
    </div>
  )
}

function AlbumMetaForm({
  album,
  onClose,
  onSaved,
}: {
  album: ApiAlbum
  onClose: () => void
  onSaved: (a: ApiAlbum) => void
}) {
  const [title, setTitle] = useState(album.title)
  const [artistName, setArtistName] = useState(album.artistName)
  const [yearStr, setYearStr] = useState(album.year != null ? String(album.year) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('O título do álbum é obrigatório.')
      return
    }
    if (!artistName.trim()) {
      setError('O nome do artista é obrigatório.')
      return
    }
    const yearParsed = parseOptionalYear(yearStr)
    if (yearStr.trim() !== '' && (yearParsed == null || yearParsed < 1000 || yearParsed > 9999)) {
      setError('Indique um ano válido (1000–9999) ou deixe em branco.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await patchAlbum(album.id, {
        title: title.trim(),
        artistName: artistName.trim(),
        year: yearParsed,
      })
      onSaved({
        ...album,
        ...updated,
      })
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
        <span className="text-gray-400">Nome do álbum</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-white focus:border-[#60cdff]/50 focus:outline-none"
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-400">Artista do álbum</span>
        <input
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-white focus:border-[#60cdff]/50 focus:outline-none"
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-400">Ano</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ex.: 2020"
          value={yearStr}
          onChange={(e) => setYearStr(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-white placeholder:text-gray-600 focus:border-[#60cdff]/50 focus:outline-none"
        />
        <span className="mt-1 block text-xs text-gray-500">Em branco se não souber ou não quiser indicar.</span>
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
