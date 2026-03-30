import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const DATA_DIR = path.join(__dirname, '..', 'data')
export const COVERS_DIR = path.join(DATA_DIR, 'covers')
export const DB_PATH = path.join(DATA_DIR, 'library.db')
