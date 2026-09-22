import { useEffect, type ReactNode } from 'react'

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[95dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-7 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-slate-800">{title}</h2>
          <button onClick={onClose} className="grid size-11 place-items-center rounded-full bg-slate-100 text-xl text-slate-500 hover:bg-slate-200" aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
