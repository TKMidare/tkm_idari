import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  size?: 'small' | 'large'
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, size = 'small', onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog ref={ref} className={`modal modal-${size}`} onClose={onClose}>
      <header className="modal-header">
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label="Kapat" onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  )
}
