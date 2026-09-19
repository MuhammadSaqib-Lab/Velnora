import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// Inlines scripts/critical.css into dist/index.html's <head> and turns the
// build's auto-injected main stylesheet <link> into a non-blocking
// preload+swap, so first paint doesn't wait on the full ~26KB gzipped
// stylesheet. Runs after `vite build` (see package.json's "build" script).
//
// CSP note: this project's script-src has no 'unsafe-inline', so the swap
// can't use an onload="..." HTML attribute (CSP blocks inline event handler
// attributes same as inline <script> blocks). It uses a tiny hashed
// <script> that calls addEventListener instead — that's not restricted by
// script-src's inline-script rule, only the <script> tag's own content is,
// and that content's sha256 hash must be added to vercel.json's CSP
// script-src, exactly like the existing JSON-LD script hash in index.html.
// This script prints the required hash; verify it matches vercel.json.

const distDir = path.resolve(import.meta.dirname, '../dist')
const htmlPath = path.join(distDir, 'index.html')
const criticalCssPath = path.resolve(import.meta.dirname, 'critical.css')

const html = fs.readFileSync(htmlPath, 'utf8')
const criticalCssRaw = fs.readFileSync(criticalCssPath, 'utf8')
const criticalCss = criticalCssRaw.slice(criticalCssRaw.indexOf('*/') + 2).trim()

const stylesheetLinkRegex = /<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/
const match = html.match(stylesheetLinkRegex)
if (!match) {
  console.error('Could not find the built stylesheet <link> in dist/index.html — aborting, nothing written.')
  process.exit(1)
}
const [fullTag, href] = match

const swapScript = `var l=document.getElementById("main-stylesheet");l.addEventListener("load",function(){l.rel="stylesheet"});`

const replacement = [
  `<style>${criticalCss}</style>`,
  `<link rel="preload" as="style" crossorigin href="${href}" id="main-stylesheet">`,
  `<script>${swapScript}</script>`,
  `<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`,
].join('\n    ')

const newHtml = html.replace(fullTag, replacement)
fs.writeFileSync(htmlPath, newHtml)

const hash = crypto.createHash('sha256').update(swapScript, 'utf8').digest('base64')
console.log(`Inlined ${criticalCss.length} bytes of critical CSS into dist/index.html.`)
console.log(`Swap script CSP hash: 'sha256-${hash}'`)
console.log(`Verify this matches the second script-src hash in vercel.json's CSP.`)
