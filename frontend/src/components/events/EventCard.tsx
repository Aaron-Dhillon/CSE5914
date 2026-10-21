import React from 'react'
import { AnimatedCard } from '../ui'
import LazyImage from '../ui/LazyImage'
import '../../styles/events.css'
import type { EventItem } from '../../services/events'

type Props = {
  event: EventItem
  onView?: (id: string) => void
  className?: string
}

export function formatEventDate(date?: string) {
  if (!date) return 'TBA'
  return new Date(date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const EventCard: React.FC<Props> = ({ event, onView, className = '' }) => {
  const { id, title, date, location, thumbnail } = event
  const thumb = thumbnail || '/block.jpg'

  return (
    <AnimatedCard
      lift={false}
      className={`event-tile ${className}`.trim()}
      role="link"
      tabIndex={0}
      aria-labelledby={`event-title-${id}`}
      onClick={() => onView?.(id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onView?.(id) }}
    >
      <div className="event-tile-art">
        <LazyImage src={thumb} alt="" width={640} height={360} />
      </div>
      <h3 id={`event-title-${id}`} className="event-tile-title">{title}</h3>
      <p className="event-tile-meta">{formatEventDate(date)}{location ? ` · ${location}` : ''}</p>
    </AnimatedCard>
  )
}

export default EventCard
