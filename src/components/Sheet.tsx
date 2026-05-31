import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export default function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        {title && <div className="sheet-title">{title}</div>}
        {children}
      </div>
    </div>
  )
}
