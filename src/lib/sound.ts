/**
 * Сигнал конца отдыха. Safari разрешает звук только после касания, поэтому
 * контекст «размораживается» при отметке подхода, а пищит потом сам.
 */
let ctx: AudioContext | null = null

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

export function beep(): void {
  if (!ctx) return
  const now = ctx.currentTime
  for (const [i, freq] of [880, 1175].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = now + i * 0.18
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.17)
  }
}
