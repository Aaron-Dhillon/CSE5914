import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper, MainContent } from '../components/layout'
import { EventGrid, EventFilters, EventHero } from '../components/events'
import { Button, Heading, Text } from '../components/ui'
import { useAuthContext } from '../context/AuthContext'
import { request } from '../services/api'
import '../styles/events.css'
import useEvents from '../hooks/useEvents'
import type { EventItem } from '../services/events'
import { getCategories } from '../services/events'
import { getCategoryPreferences } from '../services/preferences'
import { mapCategory } from '../utils/categoryMap'

const EventsPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('')
  const [page, setPage] = useState(1)
  const { events } = useEvents()

  const { user } = useAuthContext()
  const [myEvents, setMyEvents] = useState<EventItem[]>([])
  const [myEventsLoading, setMyEventsLoading] = useState(false)
  const [joinedEvents, setJoinedEvents] = useState<EventItem[]>([])
  const [joinedEventsLoading, setJoinedEventsLoading] = useState(false)
  const [followingEvents, setFollowingEvents] = useState<EventItem[]>([])
  const [followingEventsLoading, setFollowingEventsLoading] = useState(false)

  useEffect(() => {
    if (!user?.user_id) return
    let mounted = true

    async function loadMyEvents() {
      setMyEventsLoading(true)
      try {
        const data = await request(`/events/${user!.user_id}/event`)
        if (mounted) {
          setMyEvents((data || []).map((e: any) => ({
            id: e.id,
            title: e.title,
            date: e.date || '',
            location: e.location || '',
            description: e.description || '',
            thumbnail: e.thumbnail || '',
            category: e.category || '',
          })))
        }
      } catch {
        if (mounted) setMyEvents([])
      } finally {
        if (mounted) setMyEventsLoading(false)
      }
    }

    async function loadFollowingEvents() {
      setFollowingEventsLoading(true)
      try {
        const data = await request('/events/following')
        if (mounted) {
          setFollowingEvents((data || []).map((e: any) => ({
            id: e.id,
            title: e.title,
            date: e.date || '',
            location: e.location || '',
            description: e.description || '',
            thumbnail: e.thumbnail || '',
            category: e.category || '',
          })))
        }
      } catch {
        if (mounted) setFollowingEvents([])
      } finally {
        if (mounted) setFollowingEventsLoading(false)
      }
    }

    async function loadJoinedEvents() {
      setJoinedEventsLoading(true)
      try {
        const data = await request('/events/joined')
        if (mounted) {
          setJoinedEvents((data || []).map((e: any) => ({
            id: e.id,
            title: e.title,
            date: e.date || '',
            location: e.location || '',
            description: e.description || '',
            thumbnail: e.thumbnail || '',
            category: e.category || '',
          })))
        }
      } catch {
        if (mounted) setJoinedEvents([])
      } finally {
        if (mounted) setJoinedEventsLoading(false)
      }
    }

    loadMyEvents()
    loadFollowingEvents()
    loadJoinedEvents()

    return () => {
      mounted = false
    }
  }, [user])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (events || []).filter((e) => {
      if (s && !String(e.title).toLowerCase().includes(s)) return false
      if (location && e.location !== location) return false
      return true
    })
  }, [search, location, events])

  const [categories, setCategories] = useState<Array<{ id: string | number; name: string }>>([])
  const [preferredCategoryIds, setPreferredCategoryIds] = useState<Array<string | number>>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!user?.user_id) return
      setLoadingCategories(true)
      try {
        const [catsRes, prefsRes] = await Promise.all([
          getCategories(),
          getCategoryPreferences(user.user_id),
        ])
        if (!mounted) return
        setCategories(catsRes?.categories || [])
        setPreferredCategoryIds(prefsRes?.category_ids || [])
      } catch {
        if (!mounted) return
        setCategories([])
        setPreferredCategoryIds([])
      } finally {
        if (mounted) setLoadingCategories(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [user])

  const locations = useMemo(
    () => Array.from(new Set((events || []).map((e) => e.location).filter(Boolean) as string[])),
    [events]
  )

  const navigate = useNavigate()

  const handleEventClick = (id: string) => navigate(`/events/${id}`)

  const unmappedRawCategories = new Set<string>()

  const groupByCanonicalCategory = (items: EventItem[]) => {
    const map: Record<string, EventItem[]> = {}
    const ungrouped: EventItem[] = []

    for (const ev of items) {
      const raw = (ev as any).category
      const cat = mapCategory(raw)

      console.info('EventsPage: map event->category', { id: ev.id, rawCategory: raw, mapped: cat })

      if (!cat) {
        ungrouped.push(ev)
        if (raw && !unmappedRawCategories.has(String(raw))) {
          unmappedRawCategories.add(String(raw))
          console.info('EventsPage: unmapped raw category:', raw)
        }
        continue
      }

      const key = String(cat).toLowerCase()
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }

    console.info('EventsPage: grouped bucket keys:', Object.keys(map))

    const probeId = '43963d6e-96fe-4b6a-a495-a683d332db31'
    const probe = items.find((x) => x.id === probeId)
    if (probe) {
      console.info('EventsPage: probe event found', {
        id: probe.id,
        rawCategory: (probe as any).category,
        mapped: mapCategory((probe as any).category),
      })
    }

    return { map, ungrouped }
  }

  const prioritizeCategories = (
    all: Array<{ id: string | number; name: string }>,
    preferred: Array<string | number>
  ) => {
    const prefSet = new Set(preferred.map(String))
    const preferredOnTop = all.filter((c) => prefSet.has(String(c.id)))
    const others = all.filter((c) => !prefSet.has(String(c.id)))
    return [...preferredOnTop, ...others]
  }

  const { categorySections, remainingEvents } = useMemo(() => {
    console.info('EventsPage: diagnostics', {
      totalEvents: (events || []).length,
      filteredCount: (filtered || []).length,
      sampleFilteredIds: (filtered || []).slice(0, 10).map((e) => e.id),
    })

    const sorted = [...filtered].sort((a, b) => {
      const aScore = (a as any).source === 'user_created' ? 0 : 1
      const bScore = (b as any).source === 'user_created' ? 0 : 1
      return aScore - bScore
    })

    const groupedResult = groupByCanonicalCategory(sorted)
    const grouped = groupedResult.map
    const ungroupedEvents = groupedResult.ungrouped
    const prioritized = prioritizeCategories(categories, preferredCategoryIds)

    const selectedIds = new Set<string>()
    const sections: Array<{ title: string; events: EventItem[]; totalCount: number }> = []
    const sectionKeysAdded = new Set<string>()

    const prefSet = new Set(preferredCategoryIds.map(String))
    const preferredList = prioritized.filter((c) => prefSet.has(String(c.id)))

    if (preferredList.length > 0) {
      const normalizeDisplayName = (s: string) =>
        String(s || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '')

      const resolveBucket = (cat: { id: string | number; name: string }) => {
        const nameKey = normalizeDisplayName(String(cat.name))
        if (grouped[nameKey] && grouped[nameKey].length) return grouped[nameKey]

        const mapped = mapCategory(String(cat.name))
        if (mapped && grouped[String(mapped).toLowerCase()]) {
          return grouped[String(mapped).toLowerCase()]
        }

        const rawName = String(cat.name).toLowerCase()
        if (grouped[rawName] && grouped[rawName].length) return grouped[rawName]

        console.info('EventsPage: resolveBucket no match for preference:', cat.name, 'mapped->', mapped)
        return [] as EventItem[]
      }

      for (const cat of preferredList) {
        const bucket = resolveBucket(cat)
        const slice = bucket.slice(0, 4)
        for (const e of slice) selectedIds.add(e.id)
        sections.push({ title: String(cat.name), events: slice, totalCount: bucket.length })

        const canonical = mapCategory(String(cat.name)) || normalizeDisplayName(String(cat.name))
        sectionKeysAdded.add(String(canonical).toLowerCase())
      }
    }

    const myEventIds = new Set(myEvents.map((m) => m.id))
    const remaining = filtered.filter((e) => !selectedIds.has(e.id) && !myEventIds.has(e.id))

    for (const e of ungroupedEvents) {
      if (!selectedIds.has(e.id) && !myEventIds.has(e.id) && !remaining.find((r) => r.id === e.id)) {
        remaining.push(e)
      }
    }

    return { categorySections: sections, remainingEvents: remaining }
  }, [filtered, categories, preferredCategoryIds, myEvents, events])

  const myEventsPreview = myEvents.slice(0, 4)
  const hasMoreMyEvents = myEvents.length > 4

  const joinedEventsPreview = joinedEvents.slice(0, 4)
  const hasMoreJoinedEvents = joinedEvents.length > 4

  const followingEventsPreview = followingEvents.slice(0, 4)
  const hasMoreFollowingEvents = followingEvents.length > 4

  return (
    <PageWrapper>
      <MainContent>
        <div className="stack-vertical">
          <EventHero />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Heading level={1}>Events</Heading>
            <div>
              <Button onClick={() => navigate('/events/create')}>Create Event</Button>
            </div>
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

          <div className="events-with-sidebar">
            <div className="events-main">
              {page === 1 && categorySections.length > 0 ? (
                <aside className="events-sidebar" aria-label="Categories">
                  <nav>
                    <Heading level={3}>Categories</Heading>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {user ? (
                        <>
                          <li key="created-events-link" style={{ marginBottom: '8px' }}>
                            <a
                              href="#created-events"
                              onClick={(ev) => {
                                ev.preventDefault()
                                const el = document.getElementById('created-events')
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }}
                            >
                              Created Events
                            </a>
                          </li>

                          <li key="joined-events-link" style={{ marginBottom: '8px' }}>
                            <a
                              href="#joined-events"
                              onClick={(ev) => {
                                ev.preventDefault()
                                const el = document.getElementById('joined-events')
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }}
                            >
                              Joined Events
                            </a>
                          </li>

                          <li key="following-events-link" style={{ marginBottom: '8px' }}>
                            <a
                              href="#following-events"
                              onClick={(ev) => {
                                ev.preventDefault()
                                const el = document.getElementById('following-events')
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }}
                            >
                              From People You Follow
                            </a>
                          </li>
                        </>
                      ) : null}

                      {categorySections.map((sec) => {
                        const anchor = String(sec.title)
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/-+/g, '-')
                          .replace(/^-+|-+$/g, '')

                        return (
                          <li key={anchor} style={{ marginBottom: '8px' }}>
                            <a
                              href={`#${anchor}`}
                              onClick={(ev) => {
                                ev.preventDefault()
                                const el = document.getElementById(anchor)
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }}
                            >
                              {sec.title}
                            </a>
                          </li>
                        )
                      })}
                    </ul>
                  </nav>
                </aside>
              ) : null}

              <div className="events-content">
                {loadingCategories ? <Text as="p">Loading personalized sections...</Text> : null}

                {page === 1 &&
                  categorySections.map((sec: any) => {
                    const anchor = String(sec.title)
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/-+/g, '-')
                      .replace(/^-+|-+$/g, '')

                    const hasMore = sec.totalCount > sec.events.length

                    return (
                      <section id={anchor} key={sec.title} style={{ marginBottom: '48px' }}>
                        <Heading level={2} style={{ marginBottom: '20px' }}>
                          {sec.title}
                        </Heading>
                        <EventGrid events={sec.events} onEventClick={handleEventClick} />
                        {hasMore && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <Button
                              onClick={() =>
                                navigate(`/events/all?category=${encodeURIComponent(sec.title)}`)
                              }
                            >
                              View More
                            </Button>
                          </div>
                        )}
                      </section>
                    )
                  })}

                {page === 1 && categorySections.length === 0 && (
                  <section id="upcoming-events" style={{ marginBottom: '48px' }}>
                    <Heading level={2} style={{ marginBottom: '20px' }}>
                      Upcoming Events
                    </Heading>
                    <EventGrid events={remainingEvents.slice(0, 8)} onEventClick={handleEventClick} />
                  </section>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: '32px',
                    marginBottom: '32px',
                  }}
                >
                  <Button onClick={() => navigate('/events/all')}>View All Events</Button>
                </div>

                {user && page === 1 && (
                  <section style={{ marginBottom: '48px' }}>
                    <Heading level={2} id="my-events">
                      My Events
                    </Heading>

                    <Heading level={3} id="created-events">
                      Created Events
                    </Heading>
                    {!myEventsLoading && myEvents.length === 0 && (
                      <Text as="p">You haven't created any events yet.</Text>
                    )}
                    {(myEventsLoading || myEventsPreview.length > 0) && (
                      <EventGrid
                        events={myEventsPreview}
                        loading={myEventsLoading}
                        onEventClick={handleEventClick}
                      />
                    )}
                    {hasMoreMyEvents && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                        <Button onClick={() => navigate('/events/all?section=created')}>
                          View More
                        </Button>
                      </div>
                    )}

                    <Heading level={3} id="joined-events" style={{ marginTop: 'var(--space-lg)' }}>
                      Joined Events
                    </Heading>
                    {!joinedEventsLoading && joinedEvents.length === 0 && (
                      <Text as="p">You haven't joined any events yet.</Text>
                    )}
                    {(joinedEventsLoading || joinedEventsPreview.length > 0) && (
                      <EventGrid
                        events={joinedEventsPreview}
                        loading={joinedEventsLoading}
                        onEventClick={handleEventClick}
                      />
                    )}
                    {hasMoreJoinedEvents && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                        <Button onClick={() => navigate('/events/all?section=joined')}>
                          View More
                        </Button>
                      </div>
                    )}

                    <Heading level={3} id="following-events" style={{ marginTop: 'var(--space-lg)' }}>
                      From People You Follow
                    </Heading>
                    {!followingEventsLoading && followingEvents.length === 0 && (
                      <Text as="p">No upcoming events from your friends.</Text>
                    )}
                    {(followingEventsLoading || followingEventsPreview.length > 0) && (
                      <EventGrid
                        events={followingEventsPreview}
                        loading={followingEventsLoading}
                        onEventClick={handleEventClick}
                      />
                    )}
                    {hasMoreFollowingEvents && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                        <Button onClick={() => navigate('/events/all?section=following')}>
                          View More
                        </Button>
                      </div>
                    )}
                  </section>
                )}

              </div>
            </div>
          </div>
        </div>
      </MainContent>
    </PageWrapper>
  )
}

export default EventsPage