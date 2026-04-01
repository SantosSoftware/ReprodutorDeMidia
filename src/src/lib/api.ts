const API = ''

export type ApiAlbum = {
  id: number
  title: string
  year: number | null
  artistId: number
  artistName: string
  trackCount: number
  coverUrl: string | null
}

export type ApiTrack = {
  id: number
  title: string
  durationSeconds: number | null
  /** Número da faixa no disco. */
  trackNumber: number | null
  /** Volume / disco (1, 2, … em edições com vários discos). */
  discNumber: number | null
  albumId: number
  albumTitle: string
  /** Ano de lançamento do álbum (metadado ao nível do álbum). */
  albumYear: number | null
  artistName: string
  /** Capa do álbum desta faixa (para o player). */
  albumCoverUrl: string | null
  playCount: number
  streamUrl: string
  /** Só em `/api/tracks/recent`: id da linha de histórico (chave única na lista). */
  historyId?: number
  /** Só em `/api/tracks/recent`: data/hora da reprodução (SQLite datetime). */
  playedAt?: string
}

export type ApiArtist = {
  id: number
  name: string
  albumCount: number
  imageUrl: string | null
  /** MusicBrainz artist id, se já associado. */
  mbid?: string | null
}

export type MbArtistHit = {
  mbid: string
  name: string
  disambiguation?: string
}

export async function fetchAlbums(): Promise<ApiAlbum[]> {
  const r = await fetch(`${API}/api/albums`)
  if (!r.ok) throw new Error('Não foi possível carregar os álbuns')
  return r.json()
}

export async function fetchAlbum(id: number): Promise<ApiAlbum> {
  const r = await fetch(`${API}/api/albums/${id}`)
  if (!r.ok) throw new Error('Álbum não encontrado')
  return r.json()
}

export async function fetchTracks(albumId?: number): Promise<ApiTrack[]> {
  const q = albumId != null ? `?albumId=${albumId}` : ''
  const r = await fetch(`${API}/api/tracks${q}`)
  if (!r.ok) throw new Error('Não foi possível carregar as faixas')
  return r.json()
}

export async function fetchTracksByArtist(artistId: number): Promise<ApiTrack[]> {
  const r = await fetch(`${API}/api/tracks?artistId=${artistId}`)
  if (!r.ok) throw new Error('Não foi possível carregar as faixas do artista')
  return r.json()
}

/** Top faixas por número de reproduções (playlist automática). */
export async function fetchTopTracks(limit = 50): Promise<ApiTrack[]> {
  const r = await fetch(`${API}/api/tracks/top?limit=${limit}`)
  if (!r.ok) throw new Error('Não foi possível carregar o top de faixas')
  return r.json()
}

/** Últimas faixas reproduzidas, da mais recente para a mais antiga (playlist automática). */
export async function fetchRecentTracks(limit = 50): Promise<ApiTrack[]> {
  const r = await fetch(`${API}/api/tracks/recent?limit=${limit}`)
  if (!r.ok) throw new Error('Não foi possível carregar o histórico de reproduções')
  return r.json()
}

/** Regista uma reprodução válida (chamado pelo cliente após ≥15 s ou faixa curta completa). */
export async function registerTrackPlay(trackId: number): Promise<{ id: number; playCount: number }> {
  const r = await fetch(`${API}/api/tracks/${trackId}/play`, { method: 'POST' })
  if (!r.ok) throw new Error('Falha ao registar reprodução')
  return r.json()
}

export async function fetchArtists(): Promise<ApiArtist[]> {
  const r = await fetch(`${API}/api/artists`)
  if (!r.ok) throw new Error('Não foi possível carregar os artistas')
  return r.json()
}

export async function fetchArtist(id: number): Promise<ApiArtist> {
  const r = await fetch(`${API}/api/artists/${id}`)
  if (!r.ok) throw new Error('Artista não encontrado')
  return r.json()
}

export async function fetchAlbumsByArtist(artistId: number): Promise<ApiAlbum[]> {
  const r = await fetch(`${API}/api/artists/${artistId}/albums`)
  if (!r.ok) throw new Error('Não foi possível carregar os álbuns do artista')
  return r.json()
}

export async function uploadArtistImage(
  artistId: number,
  file: File,
): Promise<{ imageUrl: string }> {
  const fd = new FormData()
  fd.append('image', file)
  const r = await fetch(`${API}/api/artists/${artistId}/image`, {
    method: 'POST',
    body: fd,
  })
  if (!r.ok) throw new Error('Upload da imagem falhou')
  return r.json()
}

export async function searchMusicBrainzArtists(q: string): Promise<MbArtistHit[]> {
  const r = await fetch(`${API}/api/musicbrainz/artists?q=${encodeURIComponent(q)}`)
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Pesquisa MusicBrainz falhou')
  }
  return r.json()
}

export async function applyArtistImageFromMusicBrainz(
  artistId: number,
  mbid: string,
  name: string,
): Promise<{ imageUrl: string | null }> {
  const r = await fetch(`${API}/api/artists/${artistId}/image/musicbrainz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mbid, name }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Não foi possível obter a imagem')
  }
  return r.json()
}

export type LibraryConfig = {
  musicPath: string | null
}

export type LibrarySyncResult = {
  filesScanned: number
  tracksAdded: number
  tracksUpdated: number
  tracksRemoved: number
  errors: string[]
}

export async function fetchLibraryConfig(): Promise<LibraryConfig> {
  const r = await fetch(`${API}/api/library/config`)
  if (!r.ok) throw new Error('Não foi possível ler a configuração da biblioteca')
  return r.json()
}

export async function putLibraryConfig(musicPath: string): Promise<LibraryConfig> {
  const r = await fetch(`${API}/api/library/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ musicPath }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Não foi possível guardar a pasta')
  }
  return r.json()
}

/** Sincroniza com a pasta guardada (novos, alterados e ficheiros removidos). */
export async function syncLibrary(): Promise<LibrarySyncResult> {
  const r = await fetch(`${API}/api/library/sync`, { method: 'POST' })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Sincronização falhou')
  }
  return r.json()
}

export async function patchTrack(
  id: number,
  body: {
    title?: string
    artistName?: string
    albumName?: string
    trackNumber?: number | null
    discNumber?: number | null
    albumYear?: number | null
  },
): Promise<ApiTrack> {
  const r = await fetch(`${API}/api/tracks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error('Não foi possível atualizar a faixa')
  return r.json()
}

export async function patchAlbum(
  id: number,
  body: {
    title?: string
    artistName?: string
    year?: number | null
  },
): Promise<ApiAlbum> {
  const r = await fetch(`${API}/api/albums/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error('Não foi possível atualizar o álbum')
  return r.json()
}

export async function uploadAlbumCover(
  albumId: number,
  file: File,
): Promise<{ coverUrl: string }> {
  const fd = new FormData()
  fd.append('cover', file)
  const r = await fetch(`${API}/api/albums/${albumId}/cover`, {
    method: 'POST',
    body: fd,
  })
  if (!r.ok) throw new Error('Upload da capa falhou')
  return r.json()
}
