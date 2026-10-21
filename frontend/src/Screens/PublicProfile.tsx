import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageWrapper, MainContent } from '../components/layout'
import { Heading, Text, Button } from '../components/ui'
import { EventGrid } from '../components/events'
import type { EventItem } from '../services/events'
import { request } from '../services/api'
import { useAuthContext } from '../context/AuthContext'
import '../styles/events.css'
import '../styles/profile.css'

type PublicUser = {
  id: string
  display_name: string
  bio: string | null
  major: string | null
  graduation_year: number | null
  has_car: boolean | null
  verified: boolean | null
  interests: string[]
  followers: number
  following: number
}

const PublicProfile: React.FC = () => {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<PublicUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [events, setEvents] = useState<EventItem[]>([])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (!username) throw new Error('No username provided')
        const name = encodeURIComponent(username)
        const [data, followData] = await Promise.all([
          request(`/follow/${name}/publicProfile`),
          request(`/follow/${name}/isFollowing`).catch(() => ({ following: false })),
        ])
        if (!mounted) return
        const interests = typeof data.interests === 'string' ? JSON.parse(data.interests || '[]') : (data.interests || [])
        setUserData({ ...data, interests })
        setFollowing(Boolean(followData.following))

        // Their upcoming events (needs a login; quietly skipped otherwise)
        const created = await request(`/events/${encodeURIComponent(data.id)}/event`).catch(() => [])
        if (!mounted) return
        const now = Date.now()
        setEvents((created || [])
          .filter((e: any) => !e.start_time || new Date(e.start_time).getTime() >= now)
          .map((e: any) => ({ id: e.id, title: e.title, date: e.start_time, location: e.location_name || '', thumbnail: e.image_url || '' })))
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load user')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [username])

  async function handleFollow() {
    if (!username || followLoading) return
    setFollowLoading(true)
    try {
      const name = encodeURIComponent(username)
      await request(`/follow/${name}`, { method: following ? 'DELETE' : 'POST' })
      setUserData((u) => u ? { ...u, followers: u.followers + (following ? -1 : 1) } : u)
      setFollowing(!following)
    } catch (e: any) {
      alert(e?.message || 'Failed to update follow status')
    } finally {
      setFollowLoading(false)
    }
  }

  const isMe = Boolean(user && userData && user.user_id === userData.id)

  return (
    <PageWrapper>
      <MainContent>
        <button type="button" className="back-link" onClick={() => navigate(-1)}>‹ Back</button>

        {loading ? (
          <Heading level={2}>Loading…</Heading>
        ) : error || !userData ? (
          <div className="card detail-empty">
            <Heading level={2}>{error ? 'Something went wrong' : 'User not found'}</Heading>
            {error ? <Text as="p" className="muted">{error}</Text> : null}
          </div>
        ) : (
          <>
            <section className="card profile-head" style={{ marginTop: 12 }}>
              <div className="profile-banner" aria-hidden="true" />
              <div className="profile-info">
                <div className="profile-avatar" aria-hidden="true">{(userData.display_name || '?').charAt(0).toUpperCase()}</div>
                <div>
                  <h1>
                    {userData.display_name}
                    {userData.verified ? <span className="profile-badge profile-badge--ok">● Verified</span> : null}
                  </h1>
                  <p className="muted">
                    {[userData.major, userData.graduation_year ? `Class of ${userData.graduation_year}` : ''].filter(Boolean).join(' · ') || 'Ohio State student'}
                  </p>
                </div>
                <div className="public-side">
                  <div className="profile-stats">
                    <div><b>{userData.followers}</b><span>Followers</span></div>
                    <div><b>{userData.following}</b><span>Following</span></div>
                    <div><b>{events.length}</b><span>Upcoming</span></div>
                  </div>
                  {isMe ? (
                    <Button variant="ghost" onClick={() => navigate('/profile')}>Edit profile</Button>
                  ) : user ? (
                    <Button variant={following ? 'ghost' : 'white'} onClick={handleFollow} disabled={followLoading}>
                      {followLoading ? '…' : following ? '✓ Following' : '＋ Follow'}
                    </Button>
                  ) : null}
                </div>
              </div>
              {userData.bio ? <p className="profile-bio">{userData.bio}</p> : null}
            </section>

            <div className="profile-cols">
              <section className="card profile-panel">
                <h2>Interests</h2>
                {userData.interests.length ? (
                  <div className="profile-chips">
                    {userData.interests.map((name) => <span key={name} className="pill on" style={{ cursor: 'default' }}>{name}</span>)}
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>No interests picked yet.</p>
                )}
              </section>
              <section className="card profile-panel">
                <h2>Getting around</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {userData.has_car ? '🚗 Has a car, can drive to events off campus.' : '🚶 No car, sticks to events they can walk or bus to.'}
                </p>
              </section>
            </div>

            <section className="shelf" style={{ marginBottom: 72 }}>
              <div className="shelf-h"><h2>Their upcoming events</h2></div>
              {events.length ? (
                <EventGrid layout="row" events={events} onEventClick={(id) => navigate(`/events/${id}`)} />
              ) : (
                <p className="muted">{user ? 'No upcoming events created.' : 'Sign in to see their events.'}</p>
              )}
            </section>
          </>
        )}
      </MainContent>
    </PageWrapper>
  )
}

export default PublicProfile
