/**
 * Иконки приложения из одного SVG: favicon, apple-touch-icon (iOS сам скругляет углы),
 * иконки манифеста и «маскируемая» для Android — глиф внутри безопасного круга 80 %.
 * Запуск: pnpm icons
 */
import { writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const BG = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7472f2"/>
    <stop offset="1" stop-color="#4442c4"/>
  </linearGradient>
  <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
    <stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#1b1a5e" flood-opacity="0.35"/>
  </filter>`

/** Гантель: внутренние блины крупнее внешних, гриф с закруглёнными концами. */
const GLYPH = `
  <g filter="url(#shadow)" transform="rotate(-28 512 512)" fill="#ffffff">
    <rect x="330" y="480" width="364" height="64" rx="32"/>
    <rect x="262" y="338" width="78" height="348" rx="39"/>
    <rect x="684" y="338" width="78" height="348" rx="39"/>
    <rect x="178" y="404" width="72" height="216" rx="36" fill-opacity="0.92"/>
    <rect x="774" y="404" width="72" height="216" rx="36" fill-opacity="0.92"/>
  </g>`

function svg(rounded: boolean): string {
  const clip = rounded
    ? '<clipPath id="r"><rect width="1024" height="1024" rx="230"/></clipPath>'
    : ''
  const open = rounded ? '<g clip-path="url(#r)">' : '<g>'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>${BG}${clip}</defs>
  ${open}
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <rect width="1024" height="1024" fill="url(#shine)"/>
    ${GLYPH}
  </g>
</svg>`
}

function png(source: string, size: number, file: string): void {
  const out = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(new URL(`../public/${file}`, import.meta.url), out)
  console.log(`public/${file} ${size}×${size}`)
}

const square = svg(false)
const rounded = svg(true)

writeFileSync(new URL('../public/favicon.svg', import.meta.url), rounded)
png(square, 180, 'apple-touch-icon.png')
png(rounded, 192, 'pwa-192.png')
png(rounded, 512, 'pwa-512.png')
png(square, 512, 'pwa-maskable-512.png')
