import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const root =
  typeof process.env.AURALIS_USER_DATA === 'string' && process.env.AURALIS_USER_DATA.trim()
    ? process.env.AURALIS_USER_DATA.trim()
    : path.join(__dirname, '..')

export const DATA_DIR = path.join(root, 'data')
export const COVERS_DIR = path.join(DATA_DIR, 'covers')
export const DB_PATH = path.join(DATA_DIR, 'library.db')
