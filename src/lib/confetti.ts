/**
 * Конфетти на новый рекорд: холст поверх всего на полторы секунды.
 * При «уменьшении движения» в настройках системы — ничего.
 */
export function confetti(): void {
  if (typeof window === 'undefined') return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.cssText = `position:fixed;inset:0;width:${w}px;height:${h}px;pointer-events:none;z-index:90`
  canvas.setAttribute('aria-hidden', 'true')
  document.body.append(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }
  ctx.scale(dpr, dpr)
  const style = getComputedStyle(document.documentElement)
  const colors = [
    '--accent',
    '--m-chest',
    '--m-back',
    '--m-legs',
    '--m-shoulders',
    '--m-biceps',
    '--success',
  ]
    .map((v) => style.getPropertyValue(v).trim())
    .filter(Boolean)
  const parts = Array.from({ length: 110 }, () => ({
    x: w / 2 + (Math.random() - 0.5) * 80,
    y: h * 0.32,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 13 - 5,
    size: 5 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    color: colors[Math.floor(Math.random() * colors.length)] ?? '#5856d6',
  }))
  const start = performance.now()
  const frame = (t: number) => {
    const elapsed = t - start
    ctx.clearRect(0, 0, w, h)
    for (const p of parts) {
      p.vy += 0.38
      p.vx *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 1800)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
    if (elapsed < 1800) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
