#!/usr/bin/env node
/**
 * Build desktop/assets/icon.ico (Windows exe + shortcut icon) from assets/icon.png.
 * Requires: python3 + Pillow.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'desktop/assets')
const png = path.join(assets, 'icon.png')
const ico = path.join(assets, 'icon.ico')

if (!fs.existsSync(png)) {
  console.error('Missing', png)
  process.exit(1)
}

const pyScript = path.join(assets, '_prepare-icon.py')
const py = `from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert('RGBA')
w, h = im.size
s = max(w, h)
canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
canvas.paste(im, ((s - w) // 2, (s - h) // 2))
sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
icons = [canvas.resize(size, Image.LANCZOS) for size in sizes]
icons[0].save(${JSON.stringify(ico)}, format='ICO', sizes=[img.size for img in icons])
`
fs.writeFileSync(pyScript, py)
try {
  execSync(`python3 ${JSON.stringify(pyScript)}`, { stdio: 'inherit' })
} finally {
  fs.unlinkSync(pyScript)
}
console.log('Wrote', ico)
