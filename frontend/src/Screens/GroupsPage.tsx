import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper, MainContent } from '../components/layout'
import { GroupGrid, GroupFilters } from '../components/groups'
import { Button, Text } from '../components/ui'
import { useAuthContext } from '../context/AuthContext'
import * as groupsService from '../services/groups'
import useGroups from '../hooks/useGroups'
import type { GroupItem } from '../components/groups/GroupCard'
import '../styles/groups.css'

const PAGE_SIZE = 10

const GroupsPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('')
  const [page, setPage] = useState(1)
  const { groups, loading } = useGroups()

  const { user } = useAuthContext()
  const [myGroups, setMyGroups] = useState<GroupItem[]>([])
  const [myGroupsLoading, setMyGroupsLoading] = useState(false)

  useEffect(() => {
    if (!user?.user_id) return
    let mounted = true
    async function loadMyGroups() {
      setMyGroupsLoading(true)
      try {
        const data = await groupsService.myGroups()
        if (mounted) {
          setMyGroups((data?.groups || []).map((g: groupsService.Group) => ({
            id: g.id,
            name: g.name,
            members: g.member_count,
            description: g.description || '',
            thumbnail: g.image_url || undefined,
            join_policy: g.join_policy,
          })))
        }
      } catch {
        if (mounted) setMyGroups([])
      } finally {
        if (mounted) setMyGroupsLoading(false)
      }
    }
    loadMyGroups()
    return () => { mounted = false }
  }, [user])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (groups || []).filter((g) => {
      if (s && !g.name.toLowerCase().includes(s)) return false
      if (location && g.join_policy !== location) return false
      return true
    })
  }, [search, location, groups])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const locations = useMemo(() => ['open', 'approval'], [])

  const navigate = useNavigate()

  const handleGroupClick = (id: string) => navigate(`/groups/${id}`)

  return (
    <PageWrapper>
      <MainContent>
        <div className="page-head">
          <div>
            <h1>Groups</h1>
            <p>Find your people, then go to things together.</p>
          </div>
          <Button onClick={() => navigate('/groups/create')}>＋ Create group</Button>
        </div>

        <GroupFilters
          search={search}
          setSearch={(s) => { setSearch(s); setPage(1) }}
          location={location}
          setLocation={(l) => { setLocation(l); setPage(1) }}
          locations={locations}
        />

        {user && (
          <section className="shelf">
            <div className="shelf-h"><h2>My groups</h2></div>
            {myGroupsLoading ? (
              <GroupGrid groups={[]} loading={true} onGroupClick={handleGroupClick} />
            ) : myGroups.length === 0 ? (
              <Text as="p" className="muted">You haven't joined any groups yet.</Text>
            ) : (
              <GroupGrid groups={myGroups} compact onGroupClick={handleGroupClick} />
            )}
          </section>
        )}

        <section className="shelf">
          <div className="shelf-h"><h2>All groups</h2></div>
          <GroupGrid groups={paginated} loading={loading} onGroupClick={handleGroupClick} />
        </section>

        <div className="pager">
          <Button variant="ghost" aria-label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</Button>
          <span>Page {page} of {totalPages}</span>
          <Button variant="ghost" aria-label="Next page" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</Button>
        </div>
      </MainContent>
    </PageWrapper>
  )
}

export default GroupsPage
