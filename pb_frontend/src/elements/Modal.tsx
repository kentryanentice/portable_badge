import { useEffect, type ReactNode } from 'react'

type Props = {
    open:     boolean
    onClose:  () => void
    title:    string
    subtitle?: string
    children: ReactNode
}

export default function Modal({ open, onClose, title, subtitle, children }: Props) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [open, onClose])

    if (!open) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <div>
                        <h2 className="modal-title">{title}</h2>
                        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        <i className="bx bx-x" />
                    </button>
                </header>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    )
}
