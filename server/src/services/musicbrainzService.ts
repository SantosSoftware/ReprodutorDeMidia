/**
 * MusicBrainz + Cover Art Archive: pesquisa de releases, capas e enriquecimento de álbuns.
 * Respeita 1 pedido/segundo ao MusicBrainz (fila + atraso).
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  findOrCreateArtist,
  getDb,
  refreshPlayIdentityKeysForAlbum,
  updateAlbumArtistId,
  updateAlbumCoverPath,
  updateAlbumMetadataStatus,
  updateAlbumMbid,
  updateAlbumTitle,
  updateArtistImagePath,
  updateArtistMbid,
} from '../db.js'
import { COVERS_DIR } from '../paths.js'

const MB_BASE = 'https://musicbrainz.org/ws/2/'
const CAA_RELEASE = 'https://coverartarchive.org/release/'

const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT?.trim() || 'Auralis/1.0 (your@email.com)'

const MB_MIN_INTERVAL_MS = 1000
let mbLastRequestAt = 0
let mbChain: Promise<void> = Promise.resolve()

function enqueueMusicBrainz<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    await mbChain
    const now = Date.now()
    const wait = Math.max(0, MB_MIN_INTERVAL_MS - (now - mbLastRequestAt))
    if (wait > 0) {
      await new Promise<void>((r) => setTimeout(r, wait))
    }
    mbLastRequestAt = Date.now()
    return fn()
  }
  const p = run()
  mbChain = p.then(
    () => {},
    () => {},
  )
  return p
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let last: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (attempt === maxAttempts - 1) break
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

function mbHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  }
}

function caaHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  }
}

function escapeLucenePhrase(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildQueryArtistAndAlbum(artist: string, album: string): string {
  const a = escapeLucenePhrase(artist.trim())
  const r = escapeLucenePhrase(album.trim())
  return `artist:"${a}" AND release:"${r}"`
}

function buildQueryReleaseOnly(album: string): string {
  return `release:"${escapeLucenePhrase(album.trim())}"`
}

function buildQueryArtistOnly(artist: string): string {
  return `artist:"${escapeLucenePhrase(artist.trim())}"`
}

export type ReleaseMatch = {
  mbid: string
  title: string
  artistName: string
}

type MbRelease = {
  id?: string
  title?: string
  'artist-credit'?: Array<{ name?: string } | string>
}

function firstArtistName(release: MbRelease): string {
  const ac = release['artist-credit']
  if (!Array.isArray(ac) || ac.length === 0) return ''
  const first = ac[0]
  if (typeof first === 'string') return first
  return first?.name?.trim() ?? ''
}

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function scoreRelease(
  release: MbRelease,
  wantArtist: string,
  wantAlbum: string,
): number {
  const title = release.title?.trim() ?? ''
  const an = firstArtistName(release)
  const na = normalizeKey(wantArtist)
  const nal = normalizeKey(wantAlbum)
  const nt = normalizeKey(title)
  const nac = normalizeKey(an)
  let score = 0
  if (nt === nal) score += 50
  if (nac === na) score += 50
  if (nt.includes(nal) || nal.includes(nt)) score += 10
  if (nac.includes(na) || na.includes(nac)) score += 10
  return score
}

function pickBestRelease(
  releases: MbRelease[],
  wantArtist: string,
  wantAlbum: string,
): MbRelease | null {
  if (!releases.length) return null
  let best = releases[0]
  let bestScore = scoreRelease(best, wantArtist, wantAlbum)
  for (let i = 1; i < releases.length; i++) {
    const r = releases[i]
    const s = scoreRelease(r, wantArtist, wantAlbum)
    if (s > bestScore) {
      best = r
      bestScore = s
    }
  }
  const exact =
    releases.find(
      (r) =>
        normalizeKey(firstArtistName(r)) === normalizeKey(wantArtist) &&
        normalizeKey(r.title ?? '') === normalizeKey(wantAlbum),
    ) ?? null
  return exact ?? best
}

async function fetchReleaseSearch(query: string): Promise<MbRelease[]> {
  const url = `${MB_BASE}release/?query=${encodeURIComponent(query)}&fmt=json`
  return enqueueMusicBrainz(async () => {
    const res = await withRetry(() =>
      fetch(url, { headers: mbHeaders(), signal: AbortSignal.timeout(30_000) }),
    )
    if (!res.ok) {
      throw new Error(`MusicBrainz HTTP ${res.status}`)
    }
    const data = (await res.json()) as { releases?: MbRelease[] }
    return Array.isArray(data.releases) ? data.releases : []
  })
}

/**
 * Pesquisa um release no MusicBrainz (combinação artista+álbum, depois só álbum, só artista).
 */
export async function searchRelease(
  artist: string,
  album: string,
): Promise<ReleaseMatch | null> {
  const a = artist.trim()
  const al = album.trim()
  if (!a || !al) return null

  const q1 = buildQueryArtistAndAlbum(a, al)
  let list = await fetchReleaseSearch(q1)
  let picked = pickBestRelease(list, a, al)
  if (!picked?.id) {
    list = await fetchReleaseSearch(buildQueryReleaseOnly(al))
    picked = pickBestRelease(list, a, al)
  }
  if (!picked?.id) {
    list = await fetchReleaseSearch(buildQueryArtistOnly(a))
    picked = pickBestRelease(list, a, al)
  }
  if (!picked?.id) return null
  const mbid = picked.id
  const title = picked.title?.trim() || al
  const artistName = firstArtistName(picked) || a
  return { mbid, title, artistName }
}

type CaaImage = {
  image?: string
  types?: string[]
  thumbnails?: { large?: string; small?: string; [k: string]: string | undefined }
}

type CaaPayload = { images?: CaaImage[] }

/**
 * Devolve URL da capa (preferência: imagem grande / URL principal).
 */
export async function getCoverArt(mbid: string): Promise<string | null> {
  const url = `${CAA_RELEASE}${encodeURIComponent(mbid)}`
  return enqueueMusicBrainz(async () => {
    const res = await withRetry(() =>
      fetch(url, { headers: caaHeaders(), signal: AbortSignal.timeout(30_000) }),
    )
    if (res.status === 404) return null
    if (!res.ok) {
      throw new Error(`Cover Art Archive HTTP ${res.status}`)
    }
    const data = (await res.json()) as CaaPayload
    const images = data.images
    if (!Array.isArray(images) || images.length === 0) return null
    const img =
      images.find((i) => Array.isArray(i.types) && i.types.includes('Front')) ?? images[0]
    const full = img.image
    const large = img.thumbnails?.large
    return full || large || img.thumbnails?.small || null
  })
}

function extFromContentType(ct: string | null): string {
  if (!ct) return '.jpg'
  if (ct.includes('png')) return '.png'
  if (ct.includes('webp')) return '.webp'
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg'
  return '.jpg'
}

export function sanitizePathSegment(s: string, maxLen = 80): string {
  const t = s
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const slice = t.slice(0, maxLen) || 'unknown'
  return slice
}

/**
 * Descarrega imagem para disco (cria pastas). Devolve caminho relativo a COVERS_DIR.
 */
export async function downloadImage(imageUrl: string, destAbsolute: string): Promise<void> {
  await enqueueMusicBrainz(async () => {
    const res = await withRetry(() =>
      fetch(imageUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) }),
    )
    if (!res.ok) {
      throw new Error(`Download capa HTTP ${res.status}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const dir = path.dirname(destAbsolute)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(destAbsolute, buf)
  })
}

export type EnrichAlbumResult = {
  skipped?: boolean
  reason?: string
  artist?: string
  album?: string
  mbid?: string
  cover_path?: string | null
  needsMetadata?: boolean
}

function relativeCoverPath(artistSeg: string, albumSeg: string, ext: string): string {
  return path.join(artistSeg, `${albumSeg}${ext}`).split(path.sep).join('/')
}

function extFromUrl(imageUrl: string): string {
  try {
    const p = new URL(imageUrl).pathname.toLowerCase()
    if (p.endsWith('.png')) return '.png'
    if (p.endsWith('.webp')) return '.webp'
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return '.jpg'
  } catch {
    /* ignore */
  }
  return '.jpg'
}

function albumWouldConflict(artistId: number, title: string, excludeAlbumId: number): boolean {
  const db = getDb()
  const row = db
    .prepare(
      'SELECT id FROM albums WHERE artist_id = ? AND LOWER(title) = LOWER(?) AND id != ?',
    )
    .get(artistId, title.trim(), excludeAlbumId) as { id: number } | undefined
  return row != null
}

/**
 * Enriquece metadados e capa a partir do MusicBrainz / CAA.
 * Não volta a pedir se o álbum já tiver `cover_path`.
 */
export async function enrichAlbumMetadata(albumId: number): Promise<EnrichAlbumResult> {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT a.id, a.title, a.cover_path, a.mbid, a.metadata_status, ar.name AS artist_name
       FROM albums a
       JOIN artists ar ON a.artist_id = ar.id
       WHERE a.id = ?`,
    )
    .get(albumId) as
    | {
        id: number
        title: string
        cover_path: string | null
        mbid: string | null
        metadata_status: string | null
        artist_name: string
      }
    | undefined

  if (!row) {
    return { skipped: true, reason: 'not_found' }
  }

  if (row.cover_path) {
    return { skipped: true, reason: 'has_cover', cover_path: row.cover_path }
  }

  let mbid = row.mbid?.trim() || ''
  let mbTitle: string | null = null
  let mbArtist: string | null = null

  if (!mbid) {
    const match = await searchRelease(row.artist_name, row.title)
    if (!match) {
      updateAlbumMetadataStatus(albumId, 'needs_metadata')
      return {
        needsMetadata: true,
        artist: row.artist_name,
        album: row.title,
        cover_path: null,
      }
    }
    mbid = match.mbid
    mbTitle = match.title
    mbArtist = match.artistName
    updateAlbumMbid(albumId, mbid)
  }

  const imageUrl = await getCoverArt(mbid)
  if (!imageUrl) {
    updateAlbumMetadataStatus(albumId, 'needs_metadata')
    if (mbTitle && mbArtist) {
      applyMbTitleArtistIfSafe(albumId, mbTitle, mbArtist)
    }
    return {
      needsMetadata: true,
      mbid,
      artist: mbArtist ?? row.artist_name,
      album: mbTitle ?? row.title,
      cover_path: null,
    }
  }

  const artistSeg = sanitizePathSegment(mbArtist ?? row.artist_name)
  const albumSeg = sanitizePathSegment(mbTitle ?? row.title)

  let ext = extFromUrl(imageUrl)
  try {
    const head = await withRetry(() =>
      fetch(imageUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      }),
    )
    if (head.ok) {
      ext = extFromContentType(head.headers.get('content-type'))
    }
  } catch {
    /* mantém extFromUrl */
  }

  const rel = relativeCoverPath(artistSeg, albumSeg, ext)
  const destAbs = path.join(COVERS_DIR, artistSeg, `${albumSeg}${ext}`)

  try {
    await downloadImage(imageUrl, destAbs)
  } catch {
    updateAlbumMetadataStatus(albumId, 'needs_metadata')
    if (mbTitle && mbArtist) {
      applyMbTitleArtistIfSafe(albumId, mbTitle, mbArtist)
    }
    return {
      needsMetadata: true,
      mbid,
      artist: mbArtist ?? row.artist_name,
      album: mbTitle ?? row.title,
      cover_path: null,
    }
  }

  updateAlbumCoverPath(albumId, rel)
  updateAlbumMetadataStatus(albumId, null)

  if (mbTitle && mbArtist) {
    applyMbTitleArtistIfSafe(albumId, mbTitle, mbArtist)
  }

  return {
    artist: mbArtist ?? row.artist_name,
    album: mbTitle ?? row.title,
    mbid,
    cover_path: rel,
    needsMetadata: false,
  }
}

function applyMbTitleArtistIfSafe(albumId: number, mbTitle: string, mbArtist: string): void {
  const newArtistId = findOrCreateArtist(mbArtist)
  if (albumWouldConflict(newArtistId, mbTitle, albumId)) {
    return
  }
  updateAlbumTitle(albumId, mbTitle)
  updateAlbumArtistId(albumId, newArtistId)
  refreshPlayIdentityKeysForAlbum(albumId)
}

// —— Artistas: pesquisa MB + imagem (Fanart.tv / TheAudioDB; o MB não expõe fotos) ——

export type MbArtistHit = {
  mbid: string
  name: string
  disambiguation?: string
}

type MbArtistApi = {
  id?: string
  name?: string
  disambiguation?: string
}

/**
 * Pesquisa artistas no MusicBrainz (até 15 resultados).
 */
export async function searchMbArtists(query: string): Promise<MbArtistHit[]> {
  const q = query.trim()
  if (q.length < 1) return []

  const runSearch = async (luceneQuery: string): Promise<MbArtistHit[]> => {
    const url = `${MB_BASE}artist/?query=${encodeURIComponent(luceneQuery)}&fmt=json&limit=15`
    return enqueueMusicBrainz(async () => {
      const res = await withRetry(() =>
        fetch(url, { headers: mbHeaders(), signal: AbortSignal.timeout(30_000) }),
      )
      if (!res.ok) {
        throw new Error(`MusicBrainz HTTP ${res.status}`)
      }
      const data = (await res.json()) as { artists?: MbArtistApi[] }
      const list = data.artists ?? []
      return list
        .filter((a) => a.id && a.name)
        .map((a) => ({
          mbid: a.id as string,
          name: a.name as string,
          disambiguation: a.disambiguation?.trim() || undefined,
        }))
    })
  }

  let hits = await runSearch(`artist:"${escapeLucenePhrase(q)}"`)
  if (hits.length === 0) {
    hits = await runSearch(q)
  }
  return hits
}

async function fetchFanartArtistThumb(mbid: string): Promise<string | null> {
  const apiKey = process.env.FANART_TV_API_KEY?.trim()
  if (!apiKey) return null
  const clientKey = process.env.FANART_TV_CLIENT_KEY?.trim()
  let url = `https://webservice.fanart.tv/v3/music/${encodeURIComponent(mbid)}?api_key=${encodeURIComponent(apiKey)}`
  if (clientKey) {
    url += `&client_key=${encodeURIComponent(clientKey)}`
  }
  const res = await withRetry(() =>
    fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) }),
  )
  if (!res.ok) return null
  const data = (await res.json()) as {
    artistthumb?: Array<{ url?: string }>
    artistbackground?: Array<{ url?: string }>
  }
  const t = data.artistthumb?.[0]?.url
  if (t) return t
  const bg = data.artistbackground?.[0]?.url
  return bg ?? null
}

async function fetchTheAudioDbArtistThumb(artistName: string): Promise<string | null> {
  const apiKey = process.env.THEAUDIODB_API_KEY?.trim() || '1'
  const url = `https://www.theaudiodb.com/api/v1/json/${encodeURIComponent(apiKey)}/search.php?s=${encodeURIComponent(artistName.trim())}`
  const res = await withRetry(() =>
    fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) }),
  )
  if (!res.ok) return null
  const data = (await res.json()) as { artists?: Array<{ strArtistThumb?: string | null }> }
  const thumb = data.artists?.[0]?.strArtistThumb
  return thumb?.trim() || null
}

/**
 * Resolve URL de imagem: Fanart.tv (MBID) se configurado; senão miniatura TheAudioDB pelo nome.
 */
export async function resolveArtistImageUrl(
  mbid: string,
  displayNameForFallback: string,
): Promise<string | null> {
  const fanart = await fetchFanartArtistThumb(mbid)
  if (fanart) return fanart
  return fetchTheAudioDbArtistThumb(displayNameForFallback)
}

async function downloadImageDirect(imageUrl: string, destAbsolute: string): Promise<void> {
  const res = await withRetry(() =>
    fetch(imageUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) }),
  )
  if (!res.ok) {
    throw new Error(`Download imagem HTTP ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const dir = path.dirname(destAbsolute)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(destAbsolute, buf)
}

/**
 * Descarrega imagem do artista após escolha no MusicBrainz e grava em COVERS_DIR.
 */
export async function applyArtistImageFromMusicBrainz(
  artistId: number,
  mbid: string,
  displayName: string,
): Promise<{ relativePath: string }> {
  const imageUrl = await resolveArtistImageUrl(mbid, displayName)
  if (!imageUrl) {
    throw new Error(
      'Nenhuma imagem encontrada. Defina FANART_TV_API_KEY (https://fanart.tv) para fotos por MBID, ou confirme que o nome coincide com TheAudioDB.',
    )
  }
  const ext = extFromUrl(imageUrl)
  const fname = `mb-artist-${sanitizePathSegment(mbid, 36)}-${Date.now().toString(36)}${ext}`
  const destAbs = path.join(COVERS_DIR, fname)
  await downloadImageDirect(imageUrl, destAbs)
  updateArtistImagePath(artistId, fname)
  updateArtistMbid(artistId, mbid)
  return { relativePath: fname }
}
