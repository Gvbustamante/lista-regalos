import { useSyncExternalStore } from 'react'

// Un solo reloj global para todas las tarjetas (evita un setInterval por niño)
let now = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(cb)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

export function useNow() {
  return useSyncExternalStore(subscribe, () => now)
}
