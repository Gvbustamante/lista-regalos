let ctx: AudioContext | null = null

/** Los navegadores exigen un toque del usuario antes de reproducir audio */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* sin audio */
  }
}

function beep(freq: number, start: number, dur: number) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start(ctx.currentTime + start)
  osc.stop(ctx.currentTime + start + dur + 0.05)
}

/** Aviso suave: próximo a vencer */
export function playWarning() {
  unlockAudio()
  beep(880, 0, 0.25)
  beep(880, 0.35, 0.25)
  navigator.vibrate?.(200)
}

/** Alarma: tiempo terminado */
export function playTimeUp() {
  unlockAudio()
  for (let i = 0; i < 3; i++) {
    beep(1046, i * 0.6, 0.2)
    beep(784, i * 0.6 + 0.22, 0.25)
  }
  navigator.vibrate?.([300, 150, 300, 150, 300])
}
