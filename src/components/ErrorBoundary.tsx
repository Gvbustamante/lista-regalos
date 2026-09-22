import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Evita pantallas en blanco: muestra un mensaje y permite recargar */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error en la app', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas p-6 text-center">
        <div className="max-w-md rounded-3xl border border-line bg-white p-8 shadow-card">
          <div className="text-4xl">😕</div>
          <h1 className="mt-3 text-xl font-bold text-ink">Algo salió mal</h1>
          <p className="mt-2 text-sm text-slate-500">Tus datos están guardados en este dispositivo. Recarga para continuar.</p>
          <button onClick={() => location.reload()} className="mt-5 rounded-2xl bg-brand px-5 py-3 font-bold text-white">Recargar</button>
        </div>
      </div>
    )
  }
}
