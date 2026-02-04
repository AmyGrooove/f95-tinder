import { useMemo, useState } from 'react'

type TagChipsProps = {
  tags: number[]
  tagsMap: Record<string, string>
  maxVisible?: number
}

const TagChips = ({ tags, tagsMap, maxVisible = 8 }: TagChipsProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const uniqueTags = useMemo(() => Array.from(new Set(tags)), [tags])
  const visibleTags = isExpanded
    ? uniqueTags
    : uniqueTags.slice(0, maxVisible)
  const overflowCount = Math.max(uniqueTags.length - maxVisible, 0)
  const containerClass = `tagChips ${isExpanded ? 'expanded' : 'collapsed'}`

  const renderLabel = (tagId: number) =>
    tagsMap[String(tagId)] ?? `#${tagId}`

  return (
    <div className={containerClass}>
      {visibleTags.map((tagId) => (
        <span key={tagId} className="tagChip">
          {renderLabel(tagId)}
        </span>
      ))}

      {!isExpanded && overflowCount > 0 ? (
        <button
          type="button"
          className="tagChip tagChipGhost"
          onClick={() => setIsExpanded(true)}
        >
          Еще {overflowCount}
        </button>
      ) : null}

      {isExpanded && overflowCount > 0 ? (
        <button
          type="button"
          className="tagChip tagChipGhost"
          onClick={() => setIsExpanded(false)}
        >
          Скрыть
        </button>
      ) : null}
    </div>
  )
}

export { TagChips }
