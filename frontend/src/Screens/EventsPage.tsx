import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper, MainContent } from '../components/layout'
import { EventGrid, EventFilters } from '../components/events'
import { formatEventDate } from '../components/events/EventCard'
import { Button, Text } from '../components/ui'
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
        const slice = bucket.slice(0, 10)
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

  const anchorFor = (title: string) =>
    String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')

  const scrollTo = (anchor: string) =>
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Banner: first upcoming event that has a poster
  const featured = filtered.find((e) => e.thumbnail)

  const personalSections = [
    { key: 'created', title: 'Created', icon: '✏️', items: myEvents, loading: myEventsLoading, empty: "You haven't created any events yet.", cta: 'Create one ›', onCta: () => navigate('/events/create') },
    { key: 'joined', title: 'Joined', icon: '🎟️', items: joinedEvents, loading: joinedEventsLoading, empty: 'Events you join show up here.', cta: 'Browse events ›', onCta: () => navigate('/events/all') },
    { key: 'following', title: 'From people you follow', icon: '👥', items: followingEvents, loading: followingEventsLoading, empty: 'No upcoming events from your friends.', cta: 'Find people ›', onCta: () => navigate('/groups') },
  ]
  const filledPersonal = personalSections.filter((p) => p.loading || p.items.length > 0)
  const emptyPersonal = personalSections.filter((p) => !p.loading && p.items.length === 0)

  return (
    <PageWrapper>
      <MainContent>
        {featured ? (
          <section className="feature-banner">
            <img src={featured.thumbnail} alt="" />
            <div className="feature-banner-body">
              <span className="eyebrow">Featured</span>
              <h1>{featured.title}</h1>
              <p>{formatEventDate(featured.date)}{featured.location ? ` · ${featured.location}` : ''}</p>
              <Button variant="white" onClick={() => handleEventClick(featured.id)}>View event</Button>
            </div>
          </section>
        ) : null}

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
        >
          <Button onClick={() => navigate('/events/create')}>＋ Create event</Button>
        </EventFilters>

        {page === 1 && (categorySections.length > 0 || user) ? (
          <nav className="pills" aria-label="Jump to section">
            {categorySections.map((sec) => (
              <button key={sec.title} type="button" className="pill" onClick={() => scrollTo(anchorFor(sec.title))}>
                {sec.title}
              </button>
            ))}
            {user ? (
              <button type="button" className="pill" onClick={() => scrollTo('your-events')}>Your events</button>
            ) : null}
          </nav>
        ) : null}

        {loadingCategories ? <Text as="p" className="muted" style={{ marginTop: 24 }}>Loading personalized sections...</Text> : null}

        {page === 1 &&
          categorySections.map((sec) => (
            <section id={anchorFor(sec.title)} key={sec.title} className="shelf">
              <div className="shelf-h">
                <h2>{sec.title}</h2>
                <button type="button" className="shelf-link" onClick={() => navigate(`/events/all?category=${encodeURIComponent(sec.title)}`)}>
                  See all ›
                </button>
              </div>
              <EventGrid layout="row" events={sec.events} onEventClick={handleEventClick} />
            </section>
          ))}

        {page === 1 && categorySections.length === 0 && (
          <section id="upcoming-events" className="shelf">
            <div className="shelf-h">
              <h2>Upcoming events</h2>
              <button type="button" className="shelf-link" onClick={() => navigate('/events/all')}>See all ›</button>
            </div>
            <EventGrid events={remainingEvents.slice(0, 8)} onEventClick={handleEventClick} />
          </section>
        )}

        <div className="viewall">
          <Button variant="ghost" onClick={() => navigate('/events/all')}>View all events</Button>
        </div>

        {user && page === 1 && (
          <section id="your-events" className="yours shelf">
            <h2>Your events</h2>

            {filledPersonal.map((p) => (
              <div key={p.key} className="shelf" style={{ marginTop: 24 }}>
                <div className="shelf-h">
                  <h2 style={{ fontSize: 17 }}>{p.title}</h2>
                  {p.items.length > 4 ? (
                    <button type="button" className="shelf-link" onClick={() => navigate(`/events/all?section=${p.key}`)}>See all ›</button>
                  ) : null}
                </div>
                <EventGrid layout="row" events={p.items} loading={p.loading} onEventClick={handleEventClick} />
              </div>
            ))}

            {emptyPersonal.length > 0 ? (
              <div className="empty-grid">
                {emptyPersonal.map((p) => (
                  <div key={p.key} className="card empty-card">
                    <span className="ic" aria-hidden="true">{p.icon}</span>
                    <h3>{p.title}</h3>
                    <p>{p.empty}</p>
                    <button type="button" className="shelf-link" onClick={p.onCta}>{p.cta}</button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )}
      </MainContent>
    </PageWrapper>
  )
}

export default EventsPage