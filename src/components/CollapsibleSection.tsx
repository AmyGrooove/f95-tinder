import { useMemo, useState } from 'react'

type CollapsibleSectionProps = {
  id: string
  title: string
  count?: number
  isOpen?: boolean
  defaultOpen?: boolean
  onToggle?: () => void
  children: React.ReactNode
}

const CollapsibleSection = ({
  id,
  title,
  count,
  isOpen,
  defaultOpen = true,
  onToggle,
  children,
}: CollapsibleSectionProps) => {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const resolvedOpen = typeof isOpen === 'boolean' ? isOpen : localOpen

  const handleToggle = () => {
    if (typeof isOpen !== 'boolean') {
      setLocalOpen((previous) => !previous)
    }
    onToggle?.()
  }

  const toggleLabel = useMemo(() => (resolvedOpen ? 'Скрыть' : 'Показать'), [resolvedOpen])

  return (
    <section id={id} className={`collapsibleSection ${resolvedOpen ? 'isOpen' : 'isClosed'}`}>
      <button
        type="button"
        className="collapsibleHeader"
        onClick={handleToggle}
        aria-expanded={resolvedOpen}
        aria-controls={`${id}-content`}
      >
        <div>
          <span className="sectionTitle">{title}</span>
          {typeof count === 'number' ? (
            <span className="sectionMeta">{count} шт.</span>
          ) : null}
        </div>
        <div className="collapsibleToggle">{toggleLabel}</div>
      </button>

      {resolvedOpen ? (
        <div id={`${id}-content`} className="collapsibleBody">
          {children}
        </div>
      ) : null}
    </section>
  )
}

export { CollapsibleSection }
