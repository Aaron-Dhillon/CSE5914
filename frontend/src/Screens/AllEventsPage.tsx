import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageWrapper, MainContent } from '../components/layout'
import { EventGrid, EventFilters, EventHero } from '../components/events'
import { Button, Heading, Text } from '../components/ui'
import '../styles/events.css'
import useEvents from '../hooks/useEvents'
import { mapCategory } from '../utils/categoryMap'
import { request } from '../services/api'
import { useAuthContext } from '../context/AuthContext'
import type { EventItem } from '../services/events'

const PAGE_SIZE = 12

const AllEventsPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('')
  const [page, setPage] = useState(1)

  const { events, loading: allEventsLoading } = useEvents()
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const categoryParam = searchParams.get('category')
  const sectionParam = searchParams.get('section')

  const [sectionEvents, setSectionEvents] = useState<EventItem[]>([])
  const [sectionLoading, setSectionLoading] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [categoryParam, sectionParam])

  useEffect(() => {
    let mounted = true

    async function loadSectionEvents() {
      if (!sectionParam) {
        if (mounted) setSectionEvents([])
        return
      }

      setSectionLoading(true)
      try {
        let data: any[] = []

        if (sectionParam === 'following') {
          data = await request('/events/following')
        } else if (sectionParam === 'joined') {
          data = await request('/events/joined')
        } else if (sectionParam === 'created' && user?.user_id) {
          data = await request(`/events/${user.user_id}/event`)
        }

        if (!mounted) return

        setSectionEvents(
          (data || []).map((e: any) => ({
            id: e.id,
            title: e.title,
            date: e.date || '',
            location: e.location || '',
            description: e.description || '',
            thumbnail: e.thumbnail || '',
            category: e.category || '',
            source: e.source || '',
          }))
        )
      } catch (err) {
        console.error('Failed to load section events:', err)
        if (mounted) setSectionEvents([])
      } finally {
        if (mounted) setSectionLoading(false)
      }
    }

    loadSectionEvents()

    return () => {
      mounted = false
    }
  }, [sectionParam, user])

  const baseEvents = useMemo(() => {
    if (sectionParam) return sectionEvents
    return events || []
  }, [sectionParam, sectionEvents, events])

  const loading = sectionParam ? sectionLoading : allEventsLoading

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()

    return baseEvents.filter((e) => {
      if (s && !String(e.title).toLowerCase().includes(s)) return false
      if (location && e.location !== location) return false

      if (categoryParam) {
        const raw = (e as any).category
        const mapped = mapCategory(raw)
        if (!mapped || mapped !== mapCategory(categoryParam)) {
          return false
        }
      }

      return true
    })
  }, [search, location, baseEvents, categoryParam])

  const locations = useMemo(
    () => Array.from(new Set(baseEvents.map((e) => e.location).filter(Boolean) as string[])),
    [baseEvents]
  )

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered])

  const eventsToShow = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [page, filtered])

  const handleEventClick = (id: string) => navigate(`/events/${id}`)

  const heading = useMemo(() => {
    if (categoryParam) return `${categoryParam} Events`
    if (sectionParam === 'following') return 'Events From People You Follow'
    if (sectionParam === 'joined') return 'Joined Events'
    if (sectionParam === 'created') return 'Created Events'
    return 'All Events'
  }, [categoryParam, sectionParam])

  return (
    <PageWrapper>
      <MainContent>
        <div className="stack-vertical">
          <EventHero />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Heading level={1}>{heading}</Heading>
            <Button onClick={() => navigate('/events')}>Back to Events</Button>
          </div>

          <EventFilters
            search={search}
            setSearch={(s) => {
              setSearch(s)
              setPage(1)
            }}
            location={location}
            setLocation={(l) => {
              setLocation(l)
              setPage(1)
            }}
            locations={locations}
          />

          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <Text as="p" style={{ color: '#666', marginBottom: '16px' }}>
              Showing {filtered.length === 0 ? '0' : (page - 1) * PAGE_SIZE + 1} to{' '}
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} events
            </Text>

            <EventGrid events={eventsToShow} loading={loading} onEventClick={handleEventClick} />
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '32px',
                marginBottom: '32px',
              }}
            >
              <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>

              <Text as="p" style={{ minWidth: '100px', textAlign: 'center' }}>
                Page {page} of {totalPages}
              </Text>

              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </MainContent>
    </PageWrapper>
  )
}

export default AllEventsPage