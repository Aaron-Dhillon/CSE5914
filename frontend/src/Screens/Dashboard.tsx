import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Text, LazyImage } from "../components/ui";
import ReactMarkdown from 'react-markdown';
import '../styles/dashboard.css'
import '../styles/chat.css'
import { PageWrapper, MainContent } from "../components/layout";
import useEvents from '../hooks/useEvents'
import { request } from '../services/api'
import { featuredGroups as fetchFeaturedGroupsApi } from '../services/groups'
import { useAuthContext } from '../context/AuthContext'
import { getProfile } from '../services/auth'
import { CATEGORY_LABELS } from '../utils/categoryMap'

interface RecommendedEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  start_time: string;
  is_free: boolean;
  image_url?: string | null;
  category?: string;
}

interface FeaturedGroup {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  join_policy: 'open' | 'approval';
  image_url: string | null;
}


type Message = { id: string; role: 'user' | 'assistant' | 'system'; text: string }

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { events } = useEvents()
  const { user } = useAuthContext()

  // Featured events state
  const [featuredEvents, setFeaturedEvents] = useState<RecommendedEvent[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(false)

  // Featured groups state
  const [featuredGroups, setFeaturedGroups] = useState<FeaturedGroup[]>([])
  const [featuredGroupsLoading, setFeaturedGroupsLoading] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    { id: 'm1', role: 'assistant', text: 'Ask me for ideas, or pick an event below and I can explain, compare or suggest similar ones.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<string | ''>('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const [firstName, setFirstName] = useState('')

  useEffect(() => {
    if (!user?.user_id) return
    getProfile(user.user_id)
      .then((p) => setFirstName((p?.display_name || '').trim().split(/\s+/)[0] || ''))
      .catch(() => setFirstName(''))
  }, [user])

  // Fetch featured events
  const fetchFeaturedEvents = async () => {
    if (!user?.user_id) return;
    
    setFeaturedLoading(true);
    try {
      const data = await request(`/chat/top-recommendations/${user.user_id}`);
      setFeaturedEvents(data?.recommendations || []);
    } catch (err) {
      console.error("Failed to fetch featured events:", err);
      setFeaturedEvents([]);
    } finally {
      setFeaturedLoading(false);
    }
  };

  useEffect(() => {
    if (user?.user_id) {
      fetchFeaturedEvents();
    }
  }, [user, location])

  const fetchFeaturedGroups = async () => {
    setFeaturedGroupsLoading(true);
    try {
      const data = await fetchFeaturedGroupsApi(3);
      setFeaturedGroups(data?.groups ?? []);
    } catch (err) {
      console.error("Failed to fetch featured groups:", err);
      setFeaturedGroups([]);
    } finally {
      setFeaturedGroupsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeaturedGroups();
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const suggestedEvents = (events || []).map((e: any) => ({ id: e.id, title: e.title }))

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMsg: Message = { id: String(Date.now()), role: 'user', text: input }
    const updatedMessages = [...messages, userMsg]
    const historyToSend = updatedMessages.slice(-10).map(m => ({ role: m.role, content: m.text }))

    setMessages(updatedMessages)
    setInput('')

    const loadingId = `assistant-${Date.now()}`
    setMessages((prev) => [...prev, { id: loadingId, role: 'assistant', text: 'Thinking…' }])
    setLoading(true)

    try {
      const response = await request('/chat/basic', {
        method: 'POST',
        body: { history: historyToSend }
      })

      setMessages((prev) => prev.map((x) => (x.id === loadingId ? { ...x, text: response.reply } : x)))
    } catch (error) {
      console.error("Chat API Error:", error)
      const text = (error as any)?.status === 429 ? (error as any).message : "Sorry, I'm having trouble connecting."
      setMessages((prev) => prev.map((x) => (x.id === loadingId ? { ...x, text } : x)))
    } finally {
      setLoading(false)
    }
  }

  const quickPrompts = [
    { icon: '💡', text: 'Why should I go to this event?' },
    { icon: '⚖️', text: 'How does it compare to other events?' },
    { icon: '👥', text: 'Who is this event best for?' },
  ]

  return (
    <PageWrapper>
      <MainContent>
        <section className="home-hero">
          <div className="home-glow" aria-hidden="true" />
          <div className="home-hero-grid">
            <div className="card assistant">
              <div className="bot-row">
                <div className="bot-avatar" aria-hidden="true">✨</div>
                <span className="muted">GroupGetter Assistant</span>
              </div>
              <h1 className="ask-big">
                What are you doing this week{firstName ? <>, <span className="name">{firstName}</span></> : null}?
              </h1>

              <div className="chat-messages" ref={listRef} aria-live="polite">
                {messages.map((m) => (
                  <div key={m.id} className={`message ${m.role === 'user' ? 'message-user' : 'message-ai'}`}>
                    <div className="message-bubble" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>

              <div className="chat-compose">
                <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className="input chat-attach" aria-label="Attach an event">
                  <option value="">No event attached</option>
                  {suggestedEvents.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
                <div className="chat-compose-row">
                  <textarea
                    className="input"
                    placeholder="Ask about an event or your picks…"
                    value={input}
                    rows={1}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button onClick={sendMessage} disabled={loading || !input.trim()}>{loading ? 'Sending…' : 'Send'}</Button>
                </div>
              </div>
            </div>

            <aside className="card try-asking">
              <h3>Try asking</h3>
              {quickPrompts.map((p) => (
                <button key={p.text} type="button" className="prompt" onClick={() => setInput(p.text)}>
                  <span aria-hidden="true">{p.icon}</span> {p.text}
                </button>
              ))}
              <LazyImage src="/brutus.png" alt="" width={120} height={120} className="brutus-img" />
            </aside>
          </div>
        </section>

        <section className="shelf">
          <div className="shelf-h">
            <h2>Featured for you</h2>
            <button type="button" className="shelf-link" onClick={() => navigate('/events')}>See all ›</button>
          </div>
          {featuredEvents.length === 0 && !featuredLoading ? (
            <Text as="p" className="muted">No recommendations yet. Pick some interests on your Profile.</Text>
          ) : (
            <div className="poster-grid">
              {featuredEvents.map((event) => (
                <article
                  key={event.id}
                  className="poster"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/events/${event.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/events/${event.id}`) }}
                >
                  <img src={event.image_url || '/block.jpg'} alt="" loading="lazy" />
                  <div className="poster-body">
                    {event.category && CATEGORY_LABELS[event.category] ? <span className="poster-tag">{CATEGORY_LABELS[event.category]}</span> : null}
                    <h3>{event.title}</h3>
                    <p>{event.start_time} · {event.location}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="shelf" style={{ marginBottom: 72 }}>
          <div className="shelf-h">
            <h2>Featured groups</h2>
            <button type="button" className="shelf-link" onClick={() => navigate('/groups')}>Browse ›</button>
          </div>
          {featuredGroups.length === 0 && !featuredGroupsLoading ? (
            <Text as="p" className="muted">No groups available yet.</Text>
          ) : (
            <div className="group-strip">
              {featuredGroups.map((group) => (
                <article
                  key={group.id}
                  className="card group-chip"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/groups/${group.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/groups/${group.id}`) }}
                >
                  <h3>{group.name}</h3>
                  <p>{group.member_count} {group.member_count === 1 ? 'member' : 'members'} · {group.join_policy === 'open' ? 'Open' : 'Approval needed'}</p>
                  {group.description ? <p className="group-chip-desc">{group.description}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </MainContent>
    </PageWrapper>
  );
};

export default Dashboard;