import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs'

const workDir = path.resolve(import.meta.dirname, '../public/work')
const widths = [640, 960, 1280]

const images = ['aqsa-physiotherapy-centre.jpg', 'grill-out-preview.jpg']

for (const file of images) {
  const inputPath = path.join(workDir, file)
  const base = file.replace(/\.jpg$/, '')
  const inputBuffer = fs.readFileSync(inputPath)
  const meta = await sharp(inputBuffer).metadata()
  console.log(`${file}: ${meta.width}x${meta.height}, ${fs.statSync(inputPath).size} bytes`)

  for (const w of widths) {
    if (w > (meta.width ?? 0)) continue

    const webpPath = path.join(workDir, `${base}-${w}w.webp`)
    await sharp(inputBuffer).resize({ width: w }).webp({ quality: 75 }).toFile(webpPath)
    const webpSize = fs.statSync(webpPath).size

    const jpgPath = path.join(workDir, `${base}-${w}w.jpg`)
    await sharp(inputBuffer)
      .resize({ width: w })
      .jpeg({ quality: 72, mozjpeg: true, progressive: true })
      .toFile(jpgPath)
    const jpgSize = fs.statSync(jpgPath).size

    console.log(`  ${w}w -> webp ${webpSize} bytes, jpg ${jpgSize} bytes`)
  }
}
