/**
 * Garante config/fanart-config.json (a partir do .example) para o electron-builder
 * incluir extraResources. Copie o .example para fanart-config.json e preencha as chaves
 * antes de npm run dist; esse ficheiro está no .gitignore.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, 'config', 'fanart-config.json')
const example = path.join(root, 'config', 'fanart-config.json.example')

if (!fs.existsSync(example)) {
  console.error('Em falta: config/fanart-config.json.example')
  process.exit(1)
}
if (!fs.existsSync(target)) {
  fs.copyFileSync(example, target)
  console.warn(
    'Criado config/fanart-config.json a partir do exemplo (chaves vazias). ' +
      'Edite-o com a sua FANART_TV_API_KEY antes de distribuir, se precisar.',
  )
}
