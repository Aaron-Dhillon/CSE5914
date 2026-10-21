import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper, MainContent } from '../components/layout'
import { Heading, Text, Button, LazyImage, Input } from '../components/ui'
import { groupCover } from '../components/groups/GroupCard'
import { useAuthContext } from '../context/AuthContext'
import * as groupsService from '../services/groups'
import type { Group, GroupMember, JoinRequest } from '../services/groups'
import { request } from '../services/api'
import '../styles/groups.css'

const GroupDetail: React.FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthContext()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [groupEvents, setGroupEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  // Edit mode state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editJoinPolicy, setEditJoinPolicy] = useState('open')

  // Add event state
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [eventSearch, setEventSearch] = useState('')
  const [eventsLoading, setEventsLoading] = useState(false)

  // Joined events tracking
  const [joinedEventIds, setJoinedEventIds] = useState<Set<string>>(new Set())

  // Kick confirmation
  const [kickConfirmId, setKickConfirmId] = useState<string | null>(null)

  const myMembership = members.find((m) => m.user_id === user?.user_id)
  const isOwner = myMembership?.role === 'owner'
  const isAdmin = myMembership?.role === 'admin'
  const canManage = isOwner || isAdmin

  const loadGroup = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [groupData, membersData, eventsData] = await Promise.all([
        groupsService.getGroup(id),
        groupsService.listMembers(id),
        groupsService.listGroupEvents(id),
      ])
      setGroup(groupData?.group || null)
      setMembers(membersData?.members || [])
      setGroupEvents(eventsData?.events || [])

      // Fetch join requests (will 403 if not owner/admin, that's fine)
      try {
        const reqData = await groupsService.listJoinRequests(id)
        setJoinRequests(reqData?.requests || [])
      } catch {
        setJoinRequests([])
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load group')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    let mounted = true
    loadGroup().then(() => { if (!mounted) return })
    return () => { mounted = false }
  }, [loadGroup])

  useEffect(() => {
    if (!user?.user_id) return
    let mounted = true
    async function loadJoined() {
      try {
        const data = await request('/events/joined')
        if (mounted) {
          setJoinedEventIds(new Set((data || []).map((e: any) => e.id)))
        }
      } catch {
        if (mounted) setJoinedEventIds(new Set())
      }
    }
    loadJoined()
    return () => { mounted = false }
  }, [user])

  // --- Actions ---

  const handleJoin = async () => {
    if (!id) return
    setActionLoading(true)
    setActionMessage('')
    try {
      const result = await groupsService.joinGroup(id)
      setActionMessage(result?.message || 'Joined!')
      await loadGroup()
    } catch (e: any) {
      setActionMessage(e?.message || 'Failed to join group')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLeave = async () => {
    if (!id) return
    setActionLoading(true)
    setActionMessage('')
    try {
      await groupsService.leaveGroup(id)
      setActionMessage('Left group')
      await loadGroup()
    } catch (e: any) {
      setActionMessage(e?.message || 'Failed to leave group')
    } finally {
      setActionLoading(false)
    }
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDelete = async () => {
    if (!id) return
    setShowDeleteConfirm(false)
    setActionLoading(true)
    try {
      await groupsService.deleteGroup(id)
      navigate('/groups')
    } catch (e: any) {
      setActionMessage(e?.message || 'Failed to delete group')
      setActionLoading(false)
    }
  }

  // --- Member Management ---

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!id) return
    setActionLoading(true)
    try {
      await groupsService.updateMemberRole(id, userId, newRole)
      await loadGroup()
    } catch (e: any) {
      setActionMessage(e?.message || 'Failed to update role')
    } finally {
      setActionLoading(false)
    }
  }

  const handleKick = async (userId: string) => {
    if (!id) return
    setKickConfirmId(null)
    setActionLoading(true)
    try {
      await groupsService.kickMember(id, userId)
      await loadGroup()
    } catch (e: any) {
      setActionMessage(e?.message || 'Failed to remove member')
    } finally {
      setActionLoading(false)
    }
  }

  // --- Join Requests ---

  const handleApprove = async (requestId: string) => {
    if (!id) return
    setActionLoading(true)
    try {
      await groupsService.approveJoinRequest(id, requestId)
      await loadGroup()
    } catch (e: any) {
      setActionMessage(e?.message || 'Failed to approve request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (requestId: string) => {
    if (!id) return
    setActionLoading(true)
    try {
      await groupsService.rejectJoinRequest(id, requestId)
      await loadGroup()
    } catch (e: any) {
      setActionMessage(e?.message || 'Failed to reject request')
    } finally {
      setActionLoading(false)
    }
  }

  // --- Edit Group ---

  const startEditing = () => {
    if (!group) return
    setEditName(group.name)
    setEditDescription(group.description || '')
    setEditJoinPolicy(group.join_policy)
    setEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await groupsService.updateGroup(id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        join_policy: editJoinPolicy,
      })
      setEditing(false)
      await loadGroup()
    } catch (e: any) {
      setActionMessage(e?.message || 'Failed to update group')
    } finally {
      setActionLoading(false)
    }
  }

  // --- Group Events ---

  const handleAddEvent = async (eventId: string) => {
    if (!id) return
    setActionLoading(true)
    try {
      await groupsService.addGroupEvent(id, eventId)
      setShowAddEvent(false)
      setEventSearch('')
      await loadGroup()
    } catch (e: any) {
      setActionMessage(e?.message || 'Failed to add event')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveEvent = async (eventId: string) => {
    if (!id) return
    setActionLoading(true)
    try {
      await groupsService.removeGroupEvent(id, eventId)
      await loadGroup()
    } catch (e: any) {
      setActionMessage(e?.message || 'Failed to remove event')
    } finally {
      setActionLoading(false)
    }
  }

  const loadAllEvents = async () => {
    setEventsLoading(true)
    try {
      const data = await request('/events')
      setAllEvents(Array.isArray(data) ? data : [])
    } catch {
      setAllEvents([])
    } finally {
      setEventsLoading(false)
    }
  }

  const openAddEvent = () => {
    setShowAddEvent(true)
    loadAllEvents()
  }

  const filteredAvailableEvents = allEvents.filter((e) => {
    const alreadyLinked = groupEvents.some((ge) => ge.id === e.id)
    if (alreadyLinked) return false
    if (eventSearch.trim()) {
      return e.title?.toLowerCase().includes(eventSearch.toLowerCase())
    }
    return true
  })

  return (
    <PageWrapper>
      <MainContent>
        <button type="button" className="back-link" onClick={() => navigate(-1)}>‹ Back</button>

        {loading ? (
          <div className="detail-hero detail-hero--empty"><Heading level={2}>Loading…</Heading></div>
        ) : error || !group ? (
          <div className="card detail-empty">
            <Heading level={2}>{error ? 'Something went wrong' : 'Group not found'}</Heading>
            {error ? <Text as="p" className="muted">{error}</Text> : null}
            <Button variant="ghost" onClick={() => navigate('/groups')}>Browse groups</Button>
          </div>
        ) : (
          <>
            <section className="detail-hero">
              <div className="detail-backdrop" style={{ background: groupCover(group.id) }} />
              <div className="detail-hero-body">
                <div className="detail-poster detail-cover" style={{ background: groupCover(group.id) }}>
                  {group.image_url
                    ? <LazyImage src={group.image_url} alt={group.name} width={640} height={360} />
                    : <span className="group-initial" aria-hidden="true">{group.name.trim().charAt(0).toUpperCase()}</span>}
                </div>

                {editing ? (
                  <div className="form-stack edit-form">
                    <Input label="Group name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <div>
                      <label className="input-label" htmlFor="edit-desc">Description</label>
                      <textarea id="edit-desc" className="input" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                    </div>
                    <div>
                      <label className="input-label" htmlFor="edit-policy">Join policy</label>
                      <select id="edit-policy" className="input" value={editJoinPolicy} onChange={(e) => setEditJoinPolicy(e.target.value)}>
                        <option value="open">Open</option>
                        <option value="approval">Approval required</option>
                      </select>
                    </div>
                    <div className="detail-actions" style={{ marginTop: 0 }}>
                      <Button variant="white" onClick={handleSaveEdit} disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save'}</Button>
                      <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="eyebrow">Group</span>
                    <h1 className="detail-title" style={{ textTransform: 'capitalize' }}>{group.name}</h1>
                    <div className="detail-chips">
                      <span>👥 {group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
                      <span>{group.join_policy === 'open' ? '🔓 Open group' : '🔒 Approval required'}</span>
                      {group.creator_display_name ? <span>Created by {group.creator_display_name}</span> : null}
                    </div>
                    <div className="detail-actions">
                      {!myMembership && (
                        <Button variant="white" onClick={handleJoin} disabled={actionLoading}>
                          {actionLoading ? 'Joining...' : group.join_policy === 'open' ? '＋ Join group' : 'Request to join'}
                        </Button>
                      )}
                      {myMembership && !isOwner && (
                        <Button variant="ghost" onClick={handleLeave} disabled={actionLoading}>
                          {actionLoading ? 'Leaving...' : '✓ Member · Leave'}
                        </Button>
                      )}
                      {isOwner && <Button variant="white" onClick={startEditing}>Edit group</Button>}
                      {isOwner && !showDeleteConfirm && (
                        <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)} disabled={actionLoading}>Delete group</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {showDeleteConfirm && (
              <div className="card confirm-bar">
                <Text as="span">Delete this group? This cannot be undone.</Text>
                <Button variant="danger" onClick={handleDelete} disabled={actionLoading}>
                  {actionLoading ? 'Deleting...' : 'Yes, delete'}
                </Button>
                <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              </div>
            )}

            {actionMessage && <Text as="p" className="status-active" style={{ marginTop: 12 }}>{actionMessage}</Text>}

            <div className="detail-cols">
              <div className="stack">
                <section className="card detail-panel">
                  <h2>About</h2>
                  <Text as="div" className="detail-description">{group.description || 'No description provided.'}</Text>
                </section>

                <section className="card detail-panel">
                  <div className="panel-h">
                    <h2>Group events</h2>
                    {canManage && (
                      <div className="panel-actions">
                        <Button onClick={() => navigate(`/events/create?groupId=${id}`)}>＋ Create</Button>
                        <Button variant="ghost" onClick={openAddEvent} disabled={actionLoading}>Link existing</Button>
                      </div>
                    )}
                  </div>

                  {showAddEvent && (
                    <div className="link-panel">
                      <Input
                        label="Search events"
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        placeholder="Type to search..."
                      />
                      <div className="link-results">
                        {eventsLoading ? (
                          <Text as="p" className="muted">Loading events...</Text>
                        ) : filteredAvailableEvents.length === 0 ? (
                          <Text as="p" className="muted">No events available to add.</Text>
                        ) : (
                          filteredAvailableEvents.slice(0, 10).map((e) => (
                            <div key={e.id} className="list-row list-row--flat">
                              <div className="list-row-main">
                                <strong>{e.title}</strong>
                                {e.date && <span className="muted">{new Date(e.date).toLocaleDateString()}</span>}
                              </div>
                              <Button className="btn-sm" onClick={() => handleAddEvent(e.id)} disabled={actionLoading}>Add</Button>
                            </div>
                          ))
                        )}
                      </div>
                      <Button variant="ghost" className="btn-sm" onClick={() => { setShowAddEvent(false); setEventSearch('') }}>Close</Button>
                    </div>
                  )}

                  {groupEvents.length === 0 ? (
                    <Text as="p" className="muted">No events linked to this group yet.</Text>
                  ) : (
                    <div className="list">
                      {groupEvents.map((e) => (
                        <div
                          key={e.id}
                          className={`list-row clickable ${joinedEventIds.has(e.id) ? 'list-row--going' : ''}`}
                          role="link"
                          tabIndex={0}
                          onClick={() => navigate(`/events/${e.id}`)}
                          onKeyDown={(ev) => { if (ev.key === 'Enter') navigate(`/events/${e.id}`) }}
                        >
                          <div className="list-row-main">
                            <strong>{e.title}</strong>
                            <span className="muted">
                              {[e.start_time ? new Date(e.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '', e.location_name].filter(Boolean).join(' · ')}
                              {joinedEventIds.has(e.id) ? ' · ✓ Going' : ''}
                            </span>
                          </div>
                          {canManage && (
                            <Button
                              variant="ghost"
                              className="btn-sm btn-remove"
                              onClick={(ev) => { ev.stopPropagation(); handleRemoveEvent(e.id) }}
                              disabled={actionLoading}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="stack">
                {canManage && group.join_policy === 'approval' && joinRequests.length > 0 && (
                  <section className="card detail-panel">
                    <h2>Pending requests ({joinRequests.length})</h2>
                    <div className="list">
                      {joinRequests.map((jr) => (
                        <div key={jr.id} className="list-row">
                          <div className="avatar-sm" aria-hidden="true">{(jr.display_name || jr.email || '?').charAt(0).toUpperCase()}</div>
                          <div className="list-row-main">
                            {jr.display_name ? (
                              <button type="button" className="name-link" onClick={() => navigate(`/profile/${encodeURIComponent(jr.display_name!)}`)}>
                                {jr.display_name}
                              </button>
                            ) : (
                              <strong>{jr.email}</strong>
                            )}
                            <span className="muted">{new Date(jr.created_at).toLocaleDateString()}</span>
                          </div>
                          <Button className="btn-sm" onClick={() => handleApprove(jr.id)} disabled={actionLoading}>Approve</Button>
                          <Button variant="ghost" className="btn-sm" onClick={() => handleReject(jr.id)} disabled={actionLoading}>Reject</Button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="card detail-panel">
                  <h2>Members</h2>
                  {members.length === 0 ? (
                    <Text as="p" className="muted">No members yet.</Text>
                  ) : (
                    <div className="list">
                      {members.map((m) => (
                        <div key={m.user_id} className="list-row">
                          <div className="avatar-sm" aria-hidden="true">{(m.display_name || m.email || '?').charAt(0).toUpperCase()}</div>
                          <div className="list-row-main">
                            {m.display_name ? (
                              <button type="button" className="name-link" onClick={() => navigate(`/profile/${encodeURIComponent(m.display_name!)}`)}>
                                {m.display_name}
                              </button>
                            ) : (
                              <strong>{m.email}</strong>
                            )}
                          </div>
                          {canManage && m.role !== 'owner' ? (
                            <select
                              className="input role-select"
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                              disabled={actionLoading}
                              aria-label={`Role for ${m.display_name || m.email}`}
                            >
                              <option value="member">member</option>
                              <option value="admin">admin</option>
                            </select>
                          ) : (
                            <span className={`role-badge role-badge--${m.role}`}>{m.role}</span>
                          )}
                          {canManage && m.role !== 'owner' && m.user_id !== user?.user_id && (
                            kickConfirmId === m.user_id ? (
                              <>
                                <Button variant="danger" className="btn-sm" onClick={() => handleKick(m.user_id)} disabled={actionLoading}>Confirm</Button>
                                <Button variant="ghost" className="btn-sm" onClick={() => setKickConfirmId(null)}>Cancel</Button>
                              </>
                            ) : (
                              <Button variant="ghost" className="btn-sm btn-remove" onClick={() => setKickConfirmId(m.user_id)} disabled={actionLoading}>Remove</Button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </MainContent>
    </PageWrapper>
  )
}

export default GroupDetail
