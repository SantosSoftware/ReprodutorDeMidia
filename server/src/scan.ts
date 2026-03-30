import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from 'music-metadata'
import crypto from 'node:crypto'
import {
  cleanupEmptyAlbumsAndArtists,
  findOrCreateAlbum,
  findOrCreateArtist,
  getDb,
  getMusicLibraryPath,
  registerLibraryRoot,
  setAlbumCoverIfEmpty,
  upsertTrack,
} from './db.js'
import { COVERS_DIR } from './paths.js'

const AUDIO_EXT = new Set([
  '.mp3',
  '.flac',
  '.m4a',
  '.ogg',
  '.opus',
  '.wav',
  '.aac',
  '.wma',
])

function walkDir(dir: string, out: string[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkDir(full, out)
    else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase()
      if (AUDIO_EXT.has(ext)) out.push(full)
    }
  }
}

function firstArtist(meta: { common: { artist?: string; artists?: string[] } }): string {
  if (meta.common.artists?.length) return meta.common.artists[0] ?? ''
  return meta.common.artist ?? ''
}

function isFileUnderRoot(filePath: string, root: string): boolean {
  const f = path.resolve(filePath)
  const r = path.resolve(root)
  const rel = path.relative(r, f)
  return !rel.startsWith('..') && !path.isAbsolute(rel)
}

export type SyncResult = {
  filesScanned: number
  tracksAdded: number
  tracksUpdated: number
  tracksRemoved: number
  errors: string[]
}

/** Sincroniza a pasta guardada em definições (novos, alterados e removidos). */
export async function syncFromSavedMusicLibrary(): Promise<SyncResult> {
  const p = getMusicLibraryPath()
  if (!p?.trim()) {
    return {
      filesScanned: 0,
      tracksAdded: 0,
      tracksUpdated: 0,
      tracksRemoved: 0,
      errors: ['Defina primeiro a pasta da biblioteca nas definições.'],
    }
  }
  return syncMusicLibrary(p)
}

/**
 * Percorre a pasta, atualiza metadados das faixas, remove entradas cujo ficheiro já não existe
 * na pasta sincronizada e limpa álbuns/artistas vazios.
 */
export async function syncMusicLibrary(rootPath: string): Promise<SyncResult> {
  const normalized = path.resolve(rootPath.trim())
  if (!fs.existsSync(normalized) || !fs.statSync(normalized).isDirectory()) {
    return {
      filesScanned: 0,
      tracksAdded: 0,
      tracksUpdated: 0,
      tracksRemoved: 0,
      errors: [`Pasta inválida ou inacessível: ${rootPath}`],
    }
  }

  registerLibraryRoot(normalized)

  const files: string[] = []
  walkDir(normalized, files)
  const scannedSet = new Set(files.map((f) => path.resolve(f)))

  const db = getDb()
  let tracksAdded = 0
  let tracksUpdated = 0
  const errors: string[] = []

  for (const filePath of files) {
    try {
      const existed = db
        .prepare('SELECT id FROM tracks WHERE file_path = ?')
        .get(filePath) as { id: number } | undefined

      const meta = await parseFile(filePath)
      const duration = meta.format.duration ?? null
      const trackNo = meta.common.track?.no ?? null
      const title =
        meta.common.title?.trim() ||
        path.basename(filePath, path.extname(filePath))

      const artistName = firstArtist(meta) || 'Artista desconhecido'
      const albumName = meta.common.album?.trim() || 'Álbum desconhecido'

      const artistId = findOrCreateArtist(artistName)
      const albumId = findOrCreateAlbum(artistId, albumName)

      const pictures = meta.common.picture
      if (pictures?.length) {
        const pic = pictures[0]
        const ext = pic.format === 'image/jpeg' ? 'jpg' : pic.format === 'image/png' ? 'png' : 'jpg'
        const hash = crypto.createHash('md5').update(pic.data).digest('hex').slice(0, 12)
        const fname = `embed-${albumId}-${hash}.${ext}`
        const dest = path.join(COVERS_DIR, fname)
        if (!fs.existsSync(dest)) {
          fs.writeFileSync(dest, pic.data)
        }
        setAlbumCoverIfEmpty(albumId, fname)
      }

      upsertTrack(filePath, albumId, title, duration, trackNo)
      if (existed) tracksUpdated += 1
      else tracksAdded += 1
    } catch (err) {
      errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  let tracksRemoved = 0
  const allTracks = db.prepare('SELECT id, file_path FROM tracks').all() as {
    id: number
    file_path: string
  }[]

  for (const row of allTracks) {
    const fp = path.resolve(row.file_path)
    if (!isFileUnderRoot(fp, normalized)) continue
    if (scannedSet.has(fp)) continue
    if (fs.existsSync(fp)) continue
    db.prepare('DELETE FROM tracks WHERE id = ?').run(row.id)
    tracksRemoved += 1
  }

  cleanupEmptyAlbumsAndArtists()

  return {
    filesScanned: files.length,
    tracksAdded,
    tracksUpdated,
    tracksRemoved,
    errors,
  }
}

/** Compatibilidade: importação única a partir de um caminho (regista a pasta). */
export type ScanResult = { filesProcessed: number; tracksAdded: number; errors: string[] }

export async function scanFolder(rootPath: string): Promise<ScanResult> {
  const r = await syncMusicLibrary(rootPath)
  return {
    filesProcessed: r.filesScanned,
    tracksAdded: r.tracksAdded + r.tracksUpdated,
    errors: r.errors,
  }
}
