import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VITE_URL = 'http://localhost:5173'
/** Em produção o Express serve o SPA + API no mesmo host (sem Vite). */
const APP_URL = 'http://127.0.0.1:3001/'

const isDev = process.env.ELECTRON_DEV === '1'

let mainWindow = null

/**
 * Chaves Fanart / MusicBrainz / TheAudioDB para o processo Node do servidor.
 * 1) resources/fanart-config.json (empacotado no instalador)
 * 2) %userData%/fanart-config.json (sobrescreve sem recompilar)
 */
function applyBundledApiConfig() {
  const apply = (obj) => {
    if (!obj || typeof obj !== 'object') return
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== 'string' || !v.trim()) continue
      if (/^[A-Z][A-Z0-9_]*$/.test(k)) {
        process.env[k] = v.trim()
      }
    }
  }
  let bundledPath
  if (app.isPackaged) {
    bundledPath = path.join(process.resourcesPath, 'fanart-config.json')
  } else {
    bundledPath = path.join(__dirname, '..', 'config', 'fanart-config.json')
  }
  if (fs.existsSync(bundledPath)) {
    try {
      apply(JSON.parse(fs.readFileSync(bundledPath, 'utf8')))
    } catch {
      /* JSON inválido */
    }
  }
  const userOverride = path.join(app.getPath('userData'), 'fanart-config.json')
  if (fs.existsSync(userOverride)) {
    try {
      apply(JSON.parse(fs.readFileSync(userOverride, 'utf8')))
    } catch {
      /* JSON inválido */
    }
  }
}

async function loadBackend() {
  process.env.SERVE_SPA = '1'
  process.env.CLIENT_DIST = path.join(process.resourcesPath, 'client-dist')
  process.env.AURALIS_USER_DATA = app.getPath('userData')
  applyBundledApiConfig()
  const serverPath = path.join(process.resourcesPath, 'server', 'dist', 'index.js')
  const mod = await import(pathToFileURL(serverPath).href)
  if (mod.serverReady) {
    await mod.serverReady
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (isDev) {
    mainWindow.loadURL(VITE_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadURL(APP_URL)
  }
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    if (!isDev) {
      await loadBackend()
    }
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
