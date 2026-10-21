import React from 'react'
import { AnimatedCard } from '../ui'
import LazyImage from '../ui/LazyImage'
import '../../styles/groups.css'

export type GroupItem = {
  id: string
  name: string
  members: number
  location?: string
  description?: string
  thumbnail?: string
  join_policy?: 'open' | 'approval'
}

type Props = {
  group: GroupItem
  onView?: (id: string) => void
  compact?: boolean
  /** shows a working Join/Request button when given */
  onJoin?: (group: GroupItem) => void
  joinState?: 'none' | 'busy' | 'joined' | 'requested'
}

const COVERS = [
  'linear-gradient(135deg,#BB0000,#f97316)',
  'linear-gradient(135deg,#1e3a8a,#0ea5e9)',
  'linear-gradient(135deg,#4c1d95,#BB0000)',
  'linear-gradient(135deg,#065f46,#22c55e)',
  'linear-gradient(135deg,#831843,#a855f7)',
  'linear-gradient(135deg,#0f172a,#2563eb)',
]

// Stable gradient per group so covers don't change between renders
export function groupCover(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return COVERS[Math.abs(h) % COVERS.length]
}

const GroupCard: React.FC<Props> = ({ group, onView, compact = false, onJoin, joinState = 'none' }) => {
  const { id, name, members, description, thumbnail, join_policy } = group
  const open = () => onView?.(id)
  const policy = join_policy === 'approval' ? 'Approval needed' : 'Open'
  const cover = thumbnail
    ? <LazyImage src={thumbnail} alt="" width={640} height={320} />
    : <span className="group-initial" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>

  if (compact) {
    return (
      <div className="card group-row" role="link" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open() }}>
        <div className="group-row-icon" style={{ background: groupCover(id) }}>{cover}</div>
        <div>
          <h3>{name}</h3>
          <p>{members} {members === 1 ? 'member' : 'members'} · {policy}</p>
        </div>
      </div>
    )
  }

  return (
    <AnimatedCard
      lift={false}
      className="card group-card"
      role="link"
      tabIndex={0}
      aria-labelledby={`group-title-${id}`}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter') open() }}
    >
      <div className="group-cover" style={{ background: groupCover(id) }}>
        {cover}
        <span className="group-policy">{policy}</span>
      </div>
      <div className="group-body">
        <h3 id={`group-title-${id}`}>{name}</h3>
        {description ? <p className="group-desc">{description}</p> : null}
        <div className="group-foot">
          <span>{members} {members === 1 ? 'member' : 'members'}</span>
          {onJoin ? (
            joinState === 'joined' || joinState === 'requested' ? (
              <span className="group-cta group-cta--done">{joinState === 'joined' ? 'Joined ✓' : 'Requested'}</span>
            ) : (
              <button
                type="button"
                className={`group-cta ${join_policy === 'approval' ? 'group-cta--req' : ''}`}
                disabled={joinState === 'busy'}
                onClick={(e) => { e.stopPropagation(); onJoin(group) }}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {joinState === 'busy' ? '…' : join_policy === 'approval' ? 'Request' : 'Join'}
              </button>
            )
          ) : null}
        </div>
      </div>
    </AnimatedCard>
  )
}

export default GroupCard
