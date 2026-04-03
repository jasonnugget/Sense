// src/components/SettingsModal.tsx
import { ReactNode, useEffect } from "react"
import "./SettingsModal.css"

type SettingsModalProps = {
  open: boolean
  onClose: () => void
  onSave?: () => void
  title?: string
  children: ReactNode
}

export default function SettingsModal({
  open,
  onClose,
  onSave,
  title = "Settings",
  children,
}: SettingsModalProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="settingsOverlay" role="dialog" aria-modal="true">
      <button className="settingsBackdrop" onClick={onClose} aria-label="Close settings" />

      <div className="settingsCard" onClick={(e) => e.stopPropagation()}>
        <div className="settingsHeader">
          <h2>{title}</h2>
          <button className="settingsClose" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settingsBody">{children}</div>

        <div className="settingsFooter">
          <button className="settingsBtn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="settingsBtn primary"
            onClick={onSave}
            disabled={!onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
