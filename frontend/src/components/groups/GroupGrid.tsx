import React from 'react'
import GroupCard from './GroupCard'
import type { GroupItem } from './GroupCard'
import '../../styles/events.css'

type Props = {
  groups: GroupItem[]
  onGroupClick?: (id: string) => void
  loading?: boolean
  /** compact horizontal rows, used for "My groups" */
  compact?: boolean
}

import GroupSkeleton from './GroupSkeleton'

const GroupGrid: React.FC<Props> = ({ groups, onGroupClick, loading = false, compact = false }) => {
  if (loading) {
    return (
      <section className="groups-grid" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => <GroupSkeleton key={i} />)}
      </section>
    )
  }

  if (!groups || groups.length === 0) return <div className="empty-state">No groups found.</div>

  return (
    <section className={compact ? 'group-rows' : 'groups-grid'}>
      {groups.map((g) => <GroupCard key={g.id} group={g} onView={onGroupClick} compact={compact} />)}
    </section>
  )
}

export default GroupGrid
