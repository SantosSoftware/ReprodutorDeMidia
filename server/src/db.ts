import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { COVERS_DIR, DATA_DIR, DB_PATH } from './paths.js'

export type ArtistRow = { id: number; name: string; image_path: string | null }
export type AlbumRow = {
  id: number
  artist_id: number
  title: string
  cover_path: string | null
}
export type TrackRow = {
  id: number
  album_id: number
  file_path: string
  title: string
  duration_seconds: number | null
  track_number: number | null
  created_at: string
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  migrateArtistsImageColumn()
}

function migrateArtistsImageColumn(): void {
  const cols = db.prepare('PRAGMA table_info(artists)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'image_path')) {
    db.exec('ALTER TABLE artists ADD COLUMN image_path TEXT')
  }
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
): number {
  const t = norm(title)
  const existing = db
    .prepare('SELECT id FROM tracks WHERE file_path = ?')
    .get(filePath) as { id: number } | undefined
  if (existing) {
    db.prepare(
      `UPDATE tracks SET album_id = ?, title = ?, duration_seconds = ?, track_number = ?
       WHERE id = ?`,
    ).run(albumId, t, durationSeconds, trackNumber, existing.id)
    return existing.id
  }
  const r = db
    .prepare(
      `INSERT INTO tracks (album_id, file_path, title, duration_seconds, track_number)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(albumId, filePath, t, durationSeconds, trackNumber)
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
}

export function getTrackWithRelations(trackId: number): TrackWithRelations | null {
  const row = db
    .prepare(
      `SELECT t.*, a.artist_id, a.title AS album_title, a.cover_path AS album_cover_path, ar.name AS artist_name
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

export function updateAlbumCoverPath(albumId: number, relativeFilename: string): void {
  db.prepare('UPDATE albums SET cover_path = ? WHERE id = ?').run(relativeFilename, albumId)
}

export function updateArtistImagePath(artistId: number, relativeFilename: string): void {
  db.prepare('UPDATE artists SET image_path = ? WHERE id = ?').run(relativeFilename, artistId)
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
