import './loadEnv.js'
import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import crypto from 'node:crypto'
import {
  findOrCreateAlbum,
  findOrCreateArtist,
  getDb,
  getMusicLibraryPath,
  getTrackById,
  getTrackWithRelations,
  incrementTrackPlayCount,
  initDb,
  recordPlayHistory,
  registerLibraryRoot,
  setMusicLibraryPath,
  refreshPlayIdentityKeysForAlbum,
  updateAlbumArtistId,
  updateAlbumCoverPath,
  updateAlbumTitle,
  updateAlbumYear,
  updateArtistImagePath,
  upsertTrack,
} from './db.js'
import { COVERS_DIR } from './paths.js'
import { syncFromSavedMusicLibrary, syncMusicLibrary } from './scan.js'
import {
  applyArtistImageFromMusicBrainz,
  enrichAlbumMetadata,
  searchMbArtists,
} from './services/musicbrainzService.js'

initDb()
const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use('/api/covers', express.static(COVERS_DIR))

function mimeForAudio(filePath: string): string {
  const e = path.extname(filePath).toLowerCase()
  const m: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/opus',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.wma': 'audio/x-ms-wma',
  }
  return m[e] ?? 'application/octet-stream'
}

app.get('/api/library/config', (_req, res) => {
  res.json({ musicPath: getMusicLibraryPath() })
})

app.put('/api/library/config', (req, res) => {
  const raw = req.body?.musicPath
  if (typeof raw !== 'string' || !raw.trim()) {
    res.status(400).json({ error: 'musicPath é obrigatório' })
    return
  }
  const normalized = path.resolve(raw.trim())
  if (!fs.existsSync(normalized) || !fs.statSync(normalized).isDirectory()) {
    res.status(400).json({ error: 'Pasta inválida ou inacessível' })
    return
  }
  setMusicLibraryPath(normalized)
  registerLibraryRoot(normalized)
  res.json({ musicPath: normalized })
})

app.post('/api/library/sync', async (_req, res) => {
  try {
    const result = await syncFromSavedMusicLibrary()
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

/** Importação explícita por caminho (também grava a pasta na biblioteca). */
app.get('/api/musicbrainz/artists', async (req, res) => {
  const raw = req.query.q
  if (typeof raw !== 'string' || !raw.trim()) {
    res.status(400).json({ error: 'Parâmetro q é obrigatório' })
    return
  }
  try {
    const artists = await searchMbArtists(raw.trim())
    res.json(artists)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

app.post('/api/library/scan', async (req, res) => {
  const rootPath = req.body?.rootPath
  if (typeof rootPath !== 'string' || !rootPath.trim()) {
    res.status(400).json({ error: 'rootPath é obrigatório' })
    return
  }
  try {
    const normalized = path.resolve(rootPath.trim())
    const result = await syncMusicLibrary(normalized)
    if (result.errors.length === 0 || result.filesScanned > 0) {
      setMusicLibraryPath(normalized)
      registerLibraryRoot(normalized)
    }
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/albums', (_req, res) => {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT a.id, a.title, a.year, a.cover_path, a.mbid, a.metadata_status, ar.name AS artist_name, ar.id AS artist_id,
              (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id) AS track_count
       FROM albums a
       JOIN artists ar ON a.artist_id = ar.id
       ORDER BY ar.name COLLATE NOCASE, a.title COLLATE NOCASE`,
    )
    .all() as {
    id: number
    title: string
    year: number | null
    cover_path: string | null
    mbid: string | null
    metadata_status: string | null
    artist_name: string
    artist_id: number
    track_count: number
  }[]

  const out = rows.map((r) => ({
    id: r.id,
    title: r.title,
    year: r.year,
    artistId: r.artist_id,
    artistName: r.artist_name,
    trackCount: r.track_count,
    coverUrl: r.cover_path ? `/api/covers/${encodeURIComponent(r.cover_path)}` : null,
    mbid: r.mbid,
    metadataStatus: r.metadata_status,
  }))
  res.json(out)
})

app.get('/api/albums/:id', (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'id inválido' })
    return
  }
  const db = getDb()
  const row = db
    .prepare(
      `SELECT a.id, a.title, a.year, a.cover_path, a.mbid, a.metadata_status, ar.name AS artist_name, ar.id AS artist_id,
              (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id) AS track_count
       FROM albums a
       JOIN artists ar ON a.artist_id = ar.id
       WHERE a.id = ?`,
    )
    .get(id) as
    | {
        id: number
        title: string
        year: number | null
        cover_path: string | null
        mbid: string | null
        metadata_status: string | null
        artist_name: string
        artist_id: number
        track_count: number
      }
    | undefined
  if (!row) {
    res.status(404).json({ error: 'Álbum não encontrado' })
    return
  }
  res.json({
    id: row.id,
    title: row.title,
    year: row.year,
    artistId: row.artist_id,
    artistName: row.artist_name,
    trackCount: row.track_count,
    coverUrl: row.cover_path ? `/api/covers/${encodeURIComponent(row.cover_path)}` : null,
    mbid: row.mbid,
    metadataStatus: row.metadata_status,
  })
})

app.get('/api/tracks', (req, res) => {
  const albumId = req.query.albumId
  const artistId = req.query.artistId
  const db = getDb()
  if (albumId != null && albumId !== '') {
    const id = Number(albumId)
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'albumId inválido' })
      return
    }
    const rows = db
      .prepare(
        `SELECT t.id, t.title, t.duration_seconds, t.track_number, t.disc_number, t.file_path, t.play_count,
                a.title AS album_title, a.year AS album_year, a.cover_path AS album_cover_path, ar.name AS artist_name, a.id AS album_id
         FROM tracks t
         JOIN albums a ON t.album_id = a.id
         JOIN artists ar ON a.artist_id = ar.id
         WHERE t.album_id = ?
         ORDER BY t.disc_number IS NULL, t.disc_number, t.track_number IS NULL, t.track_number, t.title COLLATE NOCASE`,
      )
      .all(id) as TrackQueryRow[]
    res.json(rows.map(formatTrackRow))
    return
  }

  if (artistId != null && artistId !== '') {
    const id = Number(artistId)
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'artistId inválido' })
      return
    }
    const rows = db
      .prepare(
        `SELECT t.id, t.title, t.duration_seconds, t.track_number, t.disc_number, t.file_path, t.play_count,
                a.title AS album_title, a.year AS album_year, a.cover_path AS album_cover_path, ar.name AS artist_name, a.id AS album_id
         FROM tracks t
         JOIN albums a ON t.album_id = a.id
         JOIN artists ar ON a.artist_id = ar.id
         WHERE ar.id = ?
         ORDER BY a.title COLLATE NOCASE, t.disc_number IS NULL, t.disc_number, t.track_number IS NULL, t.track_number, t.title COLLATE NOCASE`,
      )
      .all(id) as TrackQueryRow[]
    res.json(rows.map(formatTrackRow))
    return
  }

  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.duration_seconds, t.track_number, t.disc_number, t.file_path, t.play_count,
              a.title AS album_title, a.year AS album_year, a.cover_path AS album_cover_path, ar.name AS artist_name, a.id AS album_id
       FROM tracks t
       JOIN albums a ON t.album_id = a.id
       JOIN artists ar ON a.artist_id = ar.id
       ORDER BY ar.name COLLATE NOCASE, a.title COLLATE NOCASE, t.disc_number IS NULL, t.disc_number, t.track_number IS NULL, t.track_number`,
    )
    .all() as TrackQueryRow[]
  res.json(rows.map(formatTrackRow))
})

type TrackQueryRow = {
  id: number
  title: string
  duration_seconds: number | null
  track_number: number | null
  disc_number: number | null
  file_path: string
  play_count: number
  album_title: string
  album_year: number | null
  album_cover_path: string | null
  artist_name: string
  album_id: number
}

function formatTrackRow(r: TrackQueryRow) {
  return {
    id: r.id,
    title: r.title,
    durationSeconds: r.duration_seconds,
    trackNumber: r.track_number,
    discNumber: r.disc_number,
    albumId: r.album_id,
    albumTitle: r.album_title,
    albumYear: r.album_year,
    artistName: r.artist_name,
    playCount: r.play_count,
    albumCoverUrl: r.album_cover_path
      ? `/api/covers/${encodeURIComponent(r.album_cover_path)}`
      : null,
    streamUrl: `/api/tracks/${r.id}/stream`,
  }
}

app.get('/api/tracks/top', (req, res) => {
  const raw = req.query.limit
  const limit = raw != null && raw !== '' ? Math.min(100, Math.max(1, Number(raw))) : 50
  if (Number.isNaN(limit)) {
    res.status(400).json({ error: 'limit inválido' })
    return
  }
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.duration_seconds, t.track_number, t.disc_number, t.file_path, t.play_count,
              a.title AS album_title, a.year AS album_year, a.cover_path AS album_cover_path, ar.name AS artist_name, a.id AS album_id
       FROM tracks t
       JOIN albums a ON t.album_id = a.id
       JOIN artists ar ON a.artist_id = ar.id
       WHERE t.play_count > 0
       ORDER BY t.play_count DESC, t.title COLLATE NOCASE
       LIMIT ?`,
    )
    .all(limit) as TrackQueryRow[]
  res.json(rows.map(formatTrackRow))
})

function parseStatsLimit(req: express.Request): number {
  const raw = req.query.limit
  const n = raw != null && raw !== '' ? Number(raw) : 15
  return Number.isNaN(n) ? 15 : Math.min(50, Math.max(1, Math.floor(n)))
}

/** Artistas com mais reproduções (soma das faixas). */
app.get('/api/stats/top-artists', (req, res) => {
  const limit = parseStatsLimit(req)
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT ar.id, ar.name, ar.image_path, SUM(t.play_count) AS total_plays
       FROM artists ar
       JOIN albums a ON a.artist_id = ar.id
       JOIN tracks t ON t.album_id = a.id
       GROUP BY ar.id, ar.name, ar.image_path
       HAVING SUM(t.play_count) > 0
       ORDER BY total_plays DESC, ar.name COLLATE NOCASE
       LIMIT ?`,
    )
    .all(limit) as { id: number; name: string; image_path: string | null; total_plays: number }[]
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      playCount: r.total_plays,
      imageUrl: r.image_path ? `/api/covers/${encodeURIComponent(r.image_path)}` : null,
    })),
  )
})

/** Álbuns com mais reproduções (soma das faixas). */
app.get('/api/stats/top-albums', (req, res) => {
  const limit = parseStatsLimit(req)
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT a.id, a.title, a.cover_path, ar.name AS artist_name, SUM(t.play_count) AS total_plays
       FROM albums a
       JOIN artists ar ON a.artist_id = ar.id
       JOIN tracks t ON t.album_id = a.id
       GROUP BY a.id, a.title, a.cover_path, ar.name
       HAVING SUM(t.play_count) > 0
       ORDER BY total_plays DESC, a.title COLLATE NOCASE
       LIMIT ?`,
    )
    .all(limit) as {
    id: number
    title: string
    cover_path: string | null
    artist_name: string
    total_plays: number
  }[]
  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      artistName: r.artist_name,
      playCount: r.total_plays,
      coverUrl: r.cover_path ? `/api/covers/${encodeURIComponent(r.cover_path)}` : null,
    })),
  )
})

app.get('/api/tracks/recent', (req, res) => {
  const raw = req.query.limit
  const limit = raw != null && raw !== '' ? Math.min(100, Math.max(1, Number(raw))) : 50
  if (Number.isNaN(limit)) {
    res.status(400).json({ error: 'limit inválido' })
    return
  }
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT ph.id AS history_id, ph.played_at,
              t.id, t.title, t.duration_seconds, t.track_number, t.disc_number, t.file_path, t.play_count,
              a.title AS album_title, a.year AS album_year, a.cover_path AS album_cover_path, ar.name AS artist_name, a.id AS album_id
       FROM play_history ph
       JOIN tracks t ON t.id = ph.track_id
       JOIN albums a ON t.album_id = a.id
       JOIN artists ar ON a.artist_id = ar.id
       ORDER BY ph.played_at DESC, ph.id DESC
       LIMIT ?`,
    )
    .all(limit) as (TrackQueryRow & { history_id: number; played_at: string })[]
  res.json(
    rows.map((r) => ({
      ...formatTrackRow(r),
      historyId: r.history_id,
      playedAt: r.played_at,
    })),
  )
})

app.post('/api/tracks/:id/play', (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'id inválido' })
    return
  }
  const row = getTrackById(id)
  if (!row) {
    res.status(404).json({ error: 'Faixa não encontrada' })
    return
  }
  incrementTrackPlayCount(id)
  recordPlayHistory(id)
  const updated = getTrackById(id)
  res.json({ id, playCount: updated?.play_count ?? row.play_count + 1 })
})

app.get('/api/tracks/:id', (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'id inválido' })
    return
  }
  const db = getDb()
  const row = db
    .prepare(
      `SELECT t.id, t.title, t.duration_seconds, t.track_number, t.disc_number, t.file_path, t.play_count,
              a.title AS album_title, a.year AS album_year, a.cover_path AS album_cover_path, ar.name AS artist_name, a.id AS album_id
       FROM tracks t
       JOIN albums a ON t.album_id = a.id
       JOIN artists ar ON a.artist_id = ar.id
       WHERE t.id = ?`,
    )
    .get(id) as TrackQueryRow | undefined
  if (!row) {
    res.status(404).json({ error: 'Faixa não encontrada' })
    return
  }
  res.json(formatTrackRow(row))
})

app.get('/api/tracks/:id/stream', (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).end()
    return
  }
  const track = getTrackById(id)
  if (!track) {
    res.status(404).end()
    return
  }
  const filePath = path.resolve(track.file_path)
  if (!fs.existsSync(filePath)) {
    res.status(404).end()
    return
  }

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const range = req.headers.range
  const mime = mimeForAudio(filePath)

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).end()
      return
    }
    const chunkSize = end - start + 1
    res.status(206)
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Length', chunkSize)
    res.setHeader('Content-Type', mime)
    fs.createReadStream(filePath, { start, end }).pipe(res)
  } else {
    res.setHeader('Content-Length', fileSize)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', mime)
    fs.createReadStream(filePath).pipe(res)
  }
})

app.patch('/api/tracks/:id', (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'id inválido' })
    return
  }
  const body = req.body as {
    title?: string
    artistName?: string
    albumName?: string
    trackNumber?: number | null | string
    discNumber?: number | null | string
    albumYear?: number | null | string
  }
  const current = getTrackWithRelations(id)
  if (!current) {
    res.status(404).json({ error: 'Faixa não encontrada' })
    return
  }

  let artistId = current.artist_id
  let albumTitle = current.album_title

  if (typeof body.artistName === 'string' && body.artistName.trim()) {
    artistId = findOrCreateArtist(body.artistName)
  }
  if (typeof body.albumName === 'string' && body.albumName.trim()) {
    albumTitle = body.albumName.trim()
  }

  const newAlbumId = findOrCreateAlbum(artistId, albumTitle)

  const title =
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : current.title

  let nextTrackNumber = current.track_number
  if ('trackNumber' in body) {
    const raw = body.trackNumber
    if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      nextTrackNumber = null
    } else {
      const n = Number(raw)
      nextTrackNumber = Number.isFinite(n) ? Math.trunc(n) : null
    }
  }

  let nextDiscNumber = current.disc_number
  if ('discNumber' in body) {
    const raw = body.discNumber
    if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      nextDiscNumber = null
    } else {
      const n = Number(raw)
      nextDiscNumber = Number.isFinite(n) && n >= 1 ? Math.trunc(n) : null
    }
  }

  if ('albumYear' in body) {
    const rawY = body.albumYear
    if (rawY === null || (typeof rawY === 'string' && rawY.trim() === '')) {
      updateAlbumYear(newAlbumId, null)
    } else {
      const y = Number(rawY)
      if (Number.isFinite(y) && y >= 1000 && y <= 9999) {
        updateAlbumYear(newAlbumId, Math.trunc(y))
      } else {
        updateAlbumYear(newAlbumId, null)
      }
    }
  }

  upsertTrack(current.file_path, newAlbumId, title, current.duration_seconds, nextTrackNumber, nextDiscNumber)

  const updated = getTrackWithRelations(id)
  if (!updated) {
    res.status(500).json({ error: 'Erro ao atualizar' })
    return
  }

  const albumCoverPath = updated.album_cover_path
  res.json({
    id: updated.id,
    title: updated.title,
    durationSeconds: updated.duration_seconds,
    trackNumber: updated.track_number,
    discNumber: updated.disc_number,
    albumId: newAlbumId,
    albumTitle,
    albumYear: updated.album_year,
    playCount: updated.play_count,
    artistName:
      typeof body.artistName === 'string' && body.artistName.trim()
        ? body.artistName.trim()
        : current.artist_name,
    albumCoverUrl: albumCoverPath
      ? `/api/covers/${encodeURIComponent(albumCoverPath)}`
      : null,
    streamUrl: `/api/tracks/${updated.id}/stream`,
  })
})

app.patch('/api/albums/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'id inválido' })
    return
  }
  const body = req.body as {
    title?: string
    artistName?: string
    year?: number | null | string
  }
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(id) as
    | { id: number; title: string; cover_path: string | null; artist_id: number }
    | undefined
  if (!album) {
    res.status(404).json({ error: 'Álbum não encontrado' })
    return
  }
  let touched = false
  if (typeof body.title === 'string' && body.title.trim()) {
    updateAlbumTitle(id, body.title.trim())
    touched = true
  }
  if (typeof body.artistName === 'string' && body.artistName.trim()) {
    const artistId = findOrCreateArtist(body.artistName.trim())
    updateAlbumArtistId(id, artistId)
    touched = true
  }
  if ('year' in body) {
    const rawY = body.year
    if (rawY === null || (typeof rawY === 'string' && rawY.trim() === '')) {
      updateAlbumYear(id, null)
    } else {
      const y = Number(rawY)
      if (Number.isFinite(y) && y >= 1000 && y <= 9999) {
        updateAlbumYear(id, Math.trunc(y))
      } else {
        updateAlbumYear(id, null)
      }
    }
    touched = true
  }
  if (touched) {
    refreshPlayIdentityKeysForAlbum(id)
    try {
      await enrichAlbumMetadata(id)
    } catch {
      /* falha de rede / API */
    }
  }
  const row = db
    .prepare(
      `SELECT a.id, a.title, a.year, a.cover_path, a.mbid, a.metadata_status, ar.name AS artist_name, ar.id AS artist_id,
              (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id) AS track_count
       FROM albums a
       JOIN artists ar ON a.artist_id = ar.id
       WHERE a.id = ?`,
    )
    .get(id) as
    | {
        id: number
        title: string
        year: number | null
        cover_path: string | null
        mbid: string | null
        metadata_status: string | null
        artist_name: string
        artist_id: number
        track_count: number
      }
    | undefined
  if (!row) {
    res.status(404).json({ error: 'Álbum não encontrado' })
    return
  }
  res.json({
    id: row.id,
    title: row.title,
    year: row.year,
    artistId: row.artist_id,
    artistName: row.artist_name,
    trackCount: row.track_count,
    coverUrl: row.cover_path ? `/api/covers/${encodeURIComponent(row.cover_path)}` : null,
    mbid: row.mbid,
    metadataStatus: row.metadata_status,
  })
})

const imageFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)
  cb(null, ok)
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, COVERS_DIR)
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg'
      cb(null, `upload-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`)
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFileFilter,
})

const uploadArtistImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, COVERS_DIR)
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg'
      cb(null, `artist-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`)
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFileFilter,
})

app.post('/api/albums/:id/cover', upload.single('cover'), (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'id inválido' })
    return
  }
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(id) as
    | { id: number; cover_path: string | null; artist_id: number }
    | undefined
  if (!album) {
    res.status(404).json({ error: 'Álbum não encontrado' })
    return
  }
  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'Ficheiro cover em falta ou tipo inválido' })
    return
  }
  const relative = file.filename
  updateAlbumCoverPath(id, relative)
  res.json({
    coverUrl: `/api/covers/${encodeURIComponent(relative)}`,
  })
})

app.get('/api/artists/:id/albums', (req, res) => {
  const artistId = Number(req.params.id)
  if (Number.isNaN(artistId)) {
    res.status(400).json({ error: 'id inválido' })
    return
  }
  const db = getDb()
  const exists = db.prepare('SELECT 1 FROM artists WHERE id = ?').get(artistId)
  if (!exists) {
    res.status(404).json({ error: 'Artista não encontrado' })
    return
  }
  const rows = db
    .prepare(
      `SELECT a.id, a.title, a.year, a.cover_path, a.mbid, a.metadata_status, ar.name AS artist_name, ar.id AS artist_id,
              (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id) AS track_count
       FROM albums a
       JOIN artists ar ON a.artist_id = ar.id
       WHERE a.artist_id = ?
       ORDER BY a.title COLLATE NOCASE`,
    )
    .all(artistId) as {
    id: number
    title: string
    year: number | null
    cover_path: string | null
    mbid: string | null
    metadata_status: string | null
    artist_name: string
    artist_id: number
    track_count: number
  }[]
  const out = rows.map((r) => ({
    id: r.id,
    title: r.title,
    year: r.year,
    artistId: r.artist_id,
    artistName: r.artist_name,
    trackCount: r.track_count,
    coverUrl: r.cover_path ? `/api/covers/${encodeURIComponent(r.cover_path)}` : null,
    mbid: r.mbid,
    metadataStatus: r.metadata_status,
  }))
  res.json(out)
})

app.get('/api/artists/:id', (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'id inválido' })
    return
  }
  const db = getDb()
  const row = db
    .prepare(
      `SELECT ar.id, ar.name, ar.image_path, ar.mbid,
              (SELECT COUNT(DISTINCT a.id) FROM albums a WHERE a.artist_id = ar.id) AS album_count
       FROM artists ar
       WHERE ar.id = ?`,
    )
    .get(id) as
    | { id: number; name: string; image_path: string | null; mbid: string | null; album_count: number }
    | undefined
  if (!row) {
    res.status(404).json({ error: 'Artista não encontrado' })
    return
  }
  res.json({
    id: row.id,
    name: row.name,
    albumCount: row.album_count,
    imageUrl: row.image_path ? `/api/covers/${encodeURIComponent(row.image_path)}` : null,
    mbid: row.mbid ?? null,
  })
})

app.post('/api/artists/:id/image/musicbrainz', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'id inválido' })
    return
  }
  const body = req.body as { mbid?: string; name?: string }
  const mbid = typeof body.mbid === 'string' ? body.mbid.trim() : ''
  const nameFromBody = typeof body.name === 'string' ? body.name.trim() : ''
  if (!mbid) {
    res.status(400).json({ error: 'mbid é obrigatório' })
    return
  }
  const db = getDb()
  const artist = db.prepare('SELECT id, name FROM artists WHERE id = ?').get(id) as
    | { id: number; name: string }
    | undefined
  if (!artist) {
    res.status(404).json({ error: 'Artista não encontrado' })
    return
  }
  const displayName = nameFromBody || artist.name
  try {
    await applyArtistImageFromMusicBrainz(id, mbid, displayName)
    const row = db.prepare('SELECT image_path FROM artists WHERE id = ?').get(id) as
      | { image_path: string | null }
      | undefined
    res.json({
      imageUrl: row?.image_path ? `/api/covers/${encodeURIComponent(row.image_path)}` : null,
    })
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

app.post('/api/artists/:id/image', uploadArtistImage.single('image'), (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'id inválido' })
    return
  }
  const db = getDb()
  const artist = db.prepare('SELECT id FROM artists WHERE id = ?').get(id) as { id: number } | undefined
  if (!artist) {
    res.status(404).json({ error: 'Artista não encontrado' })
    return
  }
  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'Ficheiro de imagem em falta ou tipo inválido' })
    return
  }
  updateArtistImagePath(id, file.filename)
  res.json({
    imageUrl: `/api/covers/${encodeURIComponent(file.filename)}`,
  })
})

app.get('/api/artists', (_req, res) => {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT ar.id, ar.name, ar.image_path, ar.mbid,
              (SELECT COUNT(DISTINCT a.id) FROM albums a WHERE a.artist_id = ar.id) AS album_count
       FROM artists ar
       ORDER BY ar.name COLLATE NOCASE`,
    )
    .all() as {
    id: number
    name: string
    image_path: string | null
    mbid: string | null
    album_count: number
  }[]
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      albumCount: r.album_count,
      imageUrl: r.image_path ? `/api/covers/${encodeURIComponent(r.image_path)}` : null,
      mbid: r.mbid,
    })),
  )
})

const clientDist = process.env.CLIENT_DIST?.trim()
const clientDistAbs = clientDist ? path.resolve(clientDist) : ''
if (process.env.SERVE_SPA === '1' && clientDistAbs) {
  app.use(express.static(clientDistAbs))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    if (req.path.startsWith('/api')) {
      next()
      return
    }
    res.sendFile(path.join(clientDistAbs, 'index.html'))
  })
}

let resolveReady!: () => void
export const serverReady = new Promise<void>((resolve) => {
  resolveReady = resolve
})

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`API em http://127.0.0.1:${PORT}`)
  resolveReady()
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `A porta ${PORT} já está em uso (ficou um servidor à escuta). Feche esse processo ou use outra porta (PowerShell: $env:PORT=3002; npm run dev) e alinhe o proxy em src/vite.config.ts.`,
    )
  } else {
    console.error(err)
  }
  process.exit(1)
})
