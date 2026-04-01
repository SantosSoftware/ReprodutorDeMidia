import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { COVERS_DIR, DATA_DIR, DB_PATH } from './paths.js'

export type ArtistRow = { id: number; name: string; image_path: string | null }
export type AlbumRow = {
  id: number
  artist_id: number
  title: string
  cover_path: string | null
  year: number | null
}
export type TrackRow = {
  id: number
  album_id: number
  file_path: string
  title: string
  duration_seconds: number | null
  track_number: number | null
  /** Volume / disco (ex.: 1 ou 2 num álbum duplo). */
  disc_number: number | null
  /** Chave lógica para contagem de reproduções (independente do caminho no disco). */
  play_identity_key: string
  created_at: string
  play_count: number
}

let db: DatabaseSync

export function getDb(): DatabaseSync {
  return db
}

export function initDb(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(COVERS_DIR, { recursive: true })
  db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS library_roots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      image_path TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_name_lower ON artists (LOWER(name));

    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      cover_path TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_artist_title ON albums(artist_id, LOWER(title));

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      duration_seconds REAL,
      track_number INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      play_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  migrateArtistsImageColumn()
  migrateTracksPlayCountColumn()
  migrateAlbumYearColumn()
  migrateTracksDiscNumberColumn()
  migratePlayIdentityKeyColumn()
  migratePlayHistoryTable()
}

function migrateArtistsImageColumn(): void {
  const cols = db.prepare('PRAGMA table_info(artists)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'image_path')) {
    db.exec('ALTER TABLE artists ADD COLUMN image_path TEXT')
  }
}

function migrateTracksPlayCountColumn(): void {
  const cols = db.prepare('PRAGMA table_info(tracks)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'play_count')) {
    db.exec('ALTER TABLE tracks ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0')
  }
}

function migrateAlbumYearColumn(): void {
  const cols = db.prepare('PRAGMA table_info(albums)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'year')) {
    db.exec('ALTER TABLE albums ADD COLUMN year INTEGER')
  }
}

function migrateTracksDiscNumberColumn(): void {
  const cols = db.prepare('PRAGMA table_info(tracks)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'disc_number')) {
    db.exec('ALTER TABLE tracks ADD COLUMN disc_number INTEGER')
  }
}

export const PLAY_HISTORY_MAX = 50

function migratePlayHistoryTable(): void {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'play_history'`)
    .get()
  if (!exists) {
    db.exec(`
      CREATE TABLE play_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        played_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_play_history_played_at ON play_history(played_at);
    `)
  }
}

/** Regista uma reprodução na lista das últimas faixas (mantém no máximo PLAY_HISTORY_MAX entradas). */
export function recordPlayHistory(trackId: number): void {
  db.prepare('INSERT INTO play_history (track_id) VALUES (?)').run(trackId)
  const row = db.prepare('SELECT COUNT(*) AS c FROM play_history').get() as { c: number }
  if (row.c > PLAY_HISTORY_MAX) {
    const excess = row.c - PLAY_HISTORY_MAX
    db.prepare(
      `DELETE FROM play_history WHERE id IN (
        SELECT id FROM play_history ORDER BY played_at ASC, id ASC LIMIT ?
      )`,
    ).run(excess)
  }
}

function migratePlayIdentityKeyColumn(): void {
  const cols = db.prepare('PRAGMA table_info(tracks)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'play_identity_key')) {
    db.exec('ALTER TABLE tracks ADD COLUMN play_identity_key TEXT')
  }
  const pending = db
    .prepare(
      `SELECT COUNT(*) AS c FROM tracks WHERE play_identity_key IS NULL OR play_identity_key = ''`,
    )
    .get() as { c: number }
  if (pending.c > 0) {
    const rows = db
      .prepare(
        `SELECT t.id, t.title, t.track_number, t.disc_number, ar.name AS artist_name, a.title AS album_title, a.year AS album_year
         FROM tracks t
         JOIN albums a ON t.album_id = a.id
         JOIN artists ar ON a.artist_id = ar.id
         WHERE t.play_identity_key IS NULL OR t.play_identity_key = ''`,
      )
      .all() as {
      id: number
      title: string
      track_number: number | null
      disc_number: number | null
      artist_name: string
      album_title: string
      album_year: number | null
    }[]
    const used = new Set<string>()
    for (const r of rows) {
      let key = computePlayIdentityKey(
        r.artist_name,
        r.album_title,
        r.title,
        r.album_year,
        r.disc_number,
        r.track_number,
      )
      if (used.has(key)) {
        key = `${key}\u0000${r.id}`
      }
      used.add(key)
      db.prepare('UPDATE tracks SET play_identity_key = ? WHERE id = ?').run(key, r.id)
    }
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_play_identity ON tracks(play_identity_key)')
}

/** Identidade lógica da faixa (reproduções seguem esta chave, não o caminho do ficheiro). */
export function computePlayIdentityKey(
  artistName: string,
  albumTitle: string,
  trackTitle: string,
  albumYear: number | null,
  discNumber: number | null,
  trackNumber: number | null,
): string {
  const a = norm(artistName).toLowerCase()
  const al = norm(albumTitle).toLowerCase()
  const tt = norm(trackTitle).toLowerCase()
  const y = albumYear != null && Number.isFinite(albumYear) ? String(Math.trunc(albumYear)) : ''
  const d = discNumber != null && discNumber >= 1 ? String(Math.trunc(discNumber)) : ''
  const tn = trackNumber != null && trackNumber >= 1 ? String(Math.trunc(trackNumber)) : ''
  return `${a}\u001f${al}\u001f${tt}\u001f${y}\u001f${d}\u001f${tn}`
}

function hashPathForIdentity(filePath: string): string {
  return crypto.createHash('sha256').update(path.resolve(filePath)).digest('hex').slice(0, 24)
}

function getAlbumIdentityContext(albumId: number): {
  artistName: string
  albumTitle: string
  year: number | null
} | null {
  const row = db
    .prepare(
      `SELECT ar.name AS artist_name, a.title AS album_title, a.year AS album_year
       FROM albums a JOIN artists ar ON a.artist_id = ar.id WHERE a.id = ?`,
    )
    .get(albumId) as
    | { artist_name: string; album_title: string; album_year: number | null }
    | undefined
  if (!row) return null
  return { artistName: row.artist_name, albumTitle: row.album_title, year: row.album_year }
}

function norm(s: string): string {
  return s.trim() || 'Desconhecido'
}

function lastId(r: { lastInsertRowid?: number | bigint }): number {
  const v = r.lastInsertRowid
  return typeof v === 'bigint' ? Number(v) : Number(v ?? 0)
}

export function findOrCreateArtist(name: string): number {
  const n = norm(name === '' ? 'Artista desconhecido' : name)
  const existing = db
    .prepare('SELECT id FROM artists WHERE LOWER(name) = LOWER(?)')
    .get(n) as { id: number } | undefined
  if (existing) return existing.id
  const r = db.prepare('INSERT INTO artists (name) VALUES (?)').run(n)
  return lastId(r)
}

export function findOrCreateAlbum(artistId: number, title: string): number {
  const t = norm(title === '' ? 'Álbum desconhecido' : title)
  const existing = db
    .prepare(
      'SELECT id FROM albums WHERE artist_id = ? AND LOWER(title) = LOWER(?)',
    )
    .get(artistId, t) as { id: number } | undefined
  if (existing) return existing.id
  const r = db
    .prepare('INSERT INTO albums (artist_id, title, cover_path) VALUES (?, ?, NULL)')
    .run(artistId, t)
  return lastId(r)
}

export function setAlbumCoverIfEmpty(albumId: number, relativeFilename: string): void {
  const row = db.prepare('SELECT cover_path FROM albums WHERE id = ?').get(albumId) as
    | { cover_path: string | null }
    | undefined
  if (row && row.cover_path == null) {
    db.prepare('UPDATE albums SET cover_path = ? WHERE id = ?').run(relativeFilename, albumId)
  }
}

export function upsertTrack(
  filePath: string,
  albumId: number,
  title: string,
  durationSeconds: number | null,
  trackNumber: number | null,
  discNumber: number | null,
): number {
  const t = norm(title)
  const ctx = getAlbumIdentityContext(albumId)
  if (!ctx) {
    throw new Error('Álbum não encontrado para identidade da faixa')
  }
  const identityKey = computePlayIdentityKey(
    ctx.artistName,
    ctx.albumTitle,
    t,
    ctx.year,
    discNumber,
    trackNumber,
  )

  const resolvedPath = path.resolve(filePath)
  const byPath = db
    .prepare('SELECT id FROM tracks WHERE file_path = ?')
    .get(filePath) as { id: number } | undefined
  if (byPath) {
    db.prepare(
      `UPDATE tracks SET album_id = ?, title = ?, duration_seconds = ?, track_number = ?, disc_number = ?, play_identity_key = ?
       WHERE id = ?`,
    ).run(albumId, t, durationSeconds, trackNumber, discNumber, identityKey, byPath.id)
    return byPath.id
  }

  const byIdentity = db
    .prepare('SELECT id, file_path FROM tracks WHERE play_identity_key = ?')
    .get(identityKey) as { id: number; file_path: string } | undefined
  if (byIdentity) {
    const oldResolved = path.resolve(byIdentity.file_path)
    if (oldResolved === resolvedPath) {
      db.prepare(
        `UPDATE tracks SET album_id = ?, title = ?, duration_seconds = ?, track_number = ?, disc_number = ?, play_identity_key = ?
         WHERE id = ?`,
      ).run(albumId, t, durationSeconds, trackNumber, discNumber, identityKey, byIdentity.id)
      return byIdentity.id
    }
    if (fs.existsSync(byIdentity.file_path)) {
      let altKey = `${identityKey}\u0000${hashPathForIdentity(filePath)}`
      while (
        db.prepare('SELECT 1 FROM tracks WHERE play_identity_key = ?').get(altKey) != null
      ) {
        altKey += 'x'
      }
      const r = db
        .prepare(
          `INSERT INTO tracks (album_id, file_path, title, duration_seconds, track_number, disc_number, play_identity_key)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(albumId, filePath, t, durationSeconds, trackNumber, discNumber, altKey)
      return lastId(r)
    }
    db.prepare(
      `UPDATE tracks SET file_path = ?, album_id = ?, title = ?, duration_seconds = ?, track_number = ?, disc_number = ?, play_identity_key = ?
       WHERE id = ?`,
    ).run(filePath, albumId, t, durationSeconds, trackNumber, discNumber, identityKey, byIdentity.id)
    return byIdentity.id
  }

  const r = db
    .prepare(
      `INSERT INTO tracks (album_id, file_path, title, duration_seconds, track_number, disc_number, play_identity_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(albumId, filePath, t, durationSeconds, trackNumber, discNumber, identityKey)
  return lastId(r)
}

export function registerLibraryRoot(rootPath: string): void {
  db.prepare('INSERT OR IGNORE INTO library_roots (path) VALUES (?)').run(rootPath)
}

export type TrackWithRelations = TrackRow & {
  artist_id: number
  album_title: string
  artist_name: string
  album_cover_path: string | null
  album_year: number | null
}

export function getTrackWithRelations(trackId: number): TrackWithRelations | null {
  const row = db
    .prepare(
      `SELECT t.*, a.artist_id, a.title AS album_title, a.cover_path AS album_cover_path,
              a.year AS album_year, ar.name AS artist_name
       FROM tracks t
       JOIN albums a ON t.album_id = a.id
       JOIN artists ar ON a.artist_id = ar.id
       WHERE t.id = ?`,
    )
    .get(trackId) as TrackWithRelations | undefined
  return row ?? null
}

export function getTrackById(trackId: number): TrackRow | null {
  const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as TrackRow | undefined
  return row ?? null
}

export function updateAlbumTitle(albumId: number, title: string): void {
  db.prepare('UPDATE albums SET title = ? WHERE id = ?').run(norm(title), albumId)
}

export function updateAlbumYear(albumId: number, year: number | null): void {
  db.prepare('UPDATE albums SET year = ? WHERE id = ?').run(year, albumId)
}

export function updateAlbumArtistId(albumId: number, artistId: number): void {
  db.prepare('UPDATE albums SET artist_id = ? WHERE id = ?').run(artistId, albumId)
}

/** Recalcula play_identity_key de todas as faixas após alterar artista/título/ano do álbum. */
export function refreshPlayIdentityKeysForAlbum(albumId: number): void {
  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.track_number, t.disc_number, ar.name AS artist_name, a.title AS album_title, a.year AS album_year
       FROM tracks t
       JOIN albums a ON t.album_id = a.id
       JOIN artists ar ON a.artist_id = ar.id
       WHERE t.album_id = ?`,
    )
    .all(albumId) as {
    id: number
    title: string
    track_number: number | null
    disc_number: number | null
    artist_name: string
    album_title: string
    album_year: number | null
  }[]
  const used = new Set<string>()
  for (const r of rows) {
    let key = computePlayIdentityKey(
      r.artist_name,
      r.album_title,
      r.title,
      r.album_year,
      r.disc_number,
      r.track_number,
    )
    if (used.has(key)) {
      key = `${key}\u0000${r.id}`
    }
    used.add(key)
    db.prepare('UPDATE tracks SET play_identity_key = ? WHERE id = ?').run(key, r.id)
  }
}

export function updateAlbumCoverPath(albumId: number, relativeFilename: string): void {
  db.prepare('UPDATE albums SET cover_path = ? WHERE id = ?').run(relativeFilename, albumId)
}

export function updateArtistImagePath(artistId: number, relativeFilename: string): void {
  db.prepare('UPDATE artists SET image_path = ? WHERE id = ?').run(relativeFilename, artistId)
}

export function incrementTrackPlayCount(trackId: number): void {
  db.prepare('UPDATE tracks SET play_count = play_count + 1 WHERE id = ?').run(trackId)
}

const KEY_MUSIC_LIBRARY = 'music_library_path'

export function getMusicLibraryPath(): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(KEY_MUSIC_LIBRARY) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setMusicLibraryPath(absolutePath: string): void {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(
    KEY_MUSIC_LIBRARY,
    absolutePath,
  )
}

/** Remove álbuns sem faixas e artistas sem álbuns. */
export function cleanupEmptyAlbumsAndArtists(): void {
  db.prepare(
    `DELETE FROM albums WHERE NOT EXISTS (SELECT 1 FROM tracks t WHERE t.album_id = albums.id)`,
  ).run()
  db.prepare(
    `DELETE FROM artists WHERE NOT EXISTS (SELECT 1 FROM albums a WHERE a.artist_id = artists.id)`,
  ).run()
}
