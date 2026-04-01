import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VITE_URL = 'http://localhost:5173'
const APP_URL = 'http://127.0.0.1:3001/'

const isDev = process.env.ELECTRON_DEV === '1'

async function loadBackend() {
  process.env.SERVE_SPA = '1'
  process.env.CLIENT_DIST = path.join(process.resourcesPath, 'client-dist')
  process.env.MEDIA_PLAYER_USER_DATA = app.getPath('userData')
  const serverPath = path.join(process.resourcesPath, 'server', 'dist', 'index.js')
  const mod = await import(pathToFileURL(serverPath).href)
  if (mod.serverReady) {
    await mod.serverReady
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (isDev) {
    win.loadURL(VITE_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadURL(APP_URL)
  }
}

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
