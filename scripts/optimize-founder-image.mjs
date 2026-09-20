import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs'

// One-off script (mirrors scripts/optimize-images.mjs's approach) for the
// founder portrait: generates AVIF/WebP/JPEG at a few widths from the
// original square upload. Re-run if the founder photo is ever replaced.

const teamDir = path.resolve(import.meta.dirname, '../public/team')
const widths = [480, 640, 960]
const sourceFile = 'muhammad-saqib-source.webp'
const base = 'muhammad-saqib'

const inputPath = path.join(teamDir, sourceFile)
const inputBuffer = fs.readFileSync(inputPath)
const meta = await sharp(inputBuffer).metadata()
console.log(`${sourceFile}: ${meta.width}x${meta.height}, ${fs.statSync(inputPath).size} bytes`)

for (const w of widths) {
  if (w > (meta.width ?? 0)) continue

  const avifPath = path.join(teamDir, `${base}-${w}w.avif`)
  await sharp(inputBuffer).resize({ width: w }).avif({ quality: 65 }).toFile(avifPath)
  const avifSize = fs.statSync(avifPath).size

  const webpPath = path.join(teamDir, `${base}-${w}w.webp`)
  await sharp(inputBuffer).resize({ width: w }).webp({ quality: 80 }).toFile(webpPath)
  const webpSize = fs.statSync(webpPath).size

  const jpgPath = path.join(teamDir, `${base}-${w}w.jpg`)
  await sharp(inputBuffer)
    .resize({ width: w })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toFile(jpgPath)
  const jpgSize = fs.statSync(jpgPath).size

  console.log(`  ${w}w -> avif ${avifSize} bytes, webp ${webpSize} bytes, jpg ${jpgSize} bytes`)
}
