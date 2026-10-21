import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper, MainContent } from '../components/layout'
import { Heading, Text, Button, LazyImage } from '../components/ui'
import { formatEventDate } from '../components/events/EventCard'
import { useAuthContext } from '../context/AuthContext'
import '../styles/events.css'
import * as eventsService from '../services/events'
import type { EventItem } from '../services/events'

const EventDetail: React.FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const [event, setEvent] = useState<EventItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAttending, setIsAttending] = useState(false)
  const [currentCapacity, setCurrentCapacity] = useState(0)
  const [rsvpLoading, setRsvpLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (!id) throw new Error('No event id')
        const data = await eventsService.getEventById(id)
        if (!mounted) return

        setEvent(data || null)
        setIsAttending(data?.isAttending ?? false)
        setCurrentCapacity(data?.currentCapacity ?? 0)
      } catch (e: any) {
        console.error('Failed to load event', e)
        if (mounted) setError(e?.message || 'Failed to load event')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  const spotsLeft = event?.capacity != null ? event.capacity - currentCapacity : null
  const isFull = event?.capacity != null && currentCapacity >= event.capacity
  const isClosed = event?.closeDate ? new Date(event.closeDate) < new Date() : false
  const isCreator = user?.user_id === event?.createdById

  const handleJoin = async () => {
    if (!id) return
    setRsvpLoading(true)
    try {
      const res = await eventsService.joinEvent(id)
      setIsAttending(true)
      setCurrentCapacity(res.currentCapacity)
    } catch (e: any) {
      console.error('Failed to join event', e)
    } finally {
      setRsvpLoading(false)
    }
  }

  const handleLeave = async () => {
    if (!id) return
    setRsvpLoading(true)
    try {
      const res = await eventsService.leaveEvent(id)
      setIsAttending(false)
      setCurrentCapacity(res.currentCapacity)
    } catch (e: any) {
      console.error('Failed to leave event', e)
    } finally {
      setRsvpLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!window.confirm('Are you sure you want to delete this event? This cannot be undone.')) return
    setRsvpLoading(true)
    try {
      await eventsService.deleteEvent(id)
      navigate('/events')
    } catch (e: any) {
      console.error('Failed to delete event', e)
    } finally {
      setRsvpLoading(false)
    }
  }

  const renderRsvpButton = () => {
    if (!event) return null

    if (isCreator) {
      return (
        <>
          <Button variant="white" onClick={() => navigate(`/events/create?editEventId=${event.id}`)}>Edit event</Button>
          <Button variant="ghost" onClick={handleDelete} disabled={rsvpLoading}>{rsvpLoading ? 'Deleting...' : 'Delete event'}</Button>
        </>
      )
    }
    if (isClosed) {
      return <Button variant="white" disabled>Registration closed</Button>
    }
    if (isAttending) {
      return <Button variant="ghost" onClick={handleLeave} disabled={rsvpLoading}>{rsvpLoading ? 'Leaving...' : '✓ Going · Leave'}</Button>
    }
    if (isFull) {
      return <Button variant="white" disabled>Event is full</Button>
    }
    return <Button variant="white" onClick={handleJoin} disabled={rsvpLoading}>{rsvpLoading ? 'Joining...' : '＋ Join event'}</Button>
  }

  return (
    <PageWrapper>
      <MainContent>
        <button type="button" className="back-link" onClick={() => navigate(-1)}>‹ Back</button>

        {loading ? (
          <div className="detail-hero detail-hero--empty"><Heading level={2}>Loading…</Heading></div>
        ) : error || !event ? (
          <div className="card detail-empty">
            <Heading level={2}>{error ? 'Something went wrong' : 'Event not found'}</Heading>
            {error ? <Text as="p" className="muted">{error}</Text> : null}
            <Button variant="ghost" onClick={() => navigate('/events')}>Browse events</Button>
          </div>
        ) : (
          <>
            <section className="detail-hero">
              <img className="detail-backdrop" src={event.thumbnail || '/block.jpg'} alt="" />
              <div className="detail-hero-body">
                <div className="detail-poster">
                  <LazyImage src={event.thumbnail || '/block.jpg'} alt={event.title} width={640} height={360} />
                </div>
                <div>
                  <span className="eyebrow">Event</span>
                  <h1 className="detail-title">{event.title}</h1>
                  <div className="detail-chips">
                    <span>🗓 {formatEventDate(event.date)}</span>
                    {event.location ? <span>📍 {event.location}</span> : null}
                    <span>👥 {currentCapacity} going{event.capacity != null ? ` · ${spotsLeft} spots left` : ''}</span>
                  </div>
                  <div className="detail-actions">{renderRsvpButton()}</div>
                </div>
              </div>
            </section>

            <div className="detail-cols">
              <section className="card detail-panel">
                <h2>About</h2>
                <Text as="div" className="detail-description">{event.description || 'No description provided.'}</Text>
              </section>
              <aside className="card detail-panel">
                <h2>Details</h2>
                <dl className="detail-list">
                  <dt>When</dt><dd>{event.date ? new Date(event.date).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) : 'TBA'}</dd>
                  {event.location ? <><dt>Where</dt><dd>{event.location}</dd></> : null}
                  <dt>Going</dt><dd>{currentCapacity}{event.capacity != null ? ` of ${event.capacity}` : ''}</dd>
                  {event.closeDate ? <><dt>RSVP by</dt><dd>{new Date(event.closeDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</dd></> : null}
                  {event.createdBy ? (
                    <>
                      <dt>Hosted by</dt>
                      <dd>
                        <button type="button" className="shelf-link" onClick={() => navigate(`/profile/${encodeURIComponent(event.createdBy || '')}`)}>
                          {event.createdBy}
                        </button>
                      </dd>
                    </>
                  ) : null}
                </dl>
              </aside>
            </div>
          </>
        )}
      </MainContent>
    </PageWrapper>
  )
}

export default EventDetail
