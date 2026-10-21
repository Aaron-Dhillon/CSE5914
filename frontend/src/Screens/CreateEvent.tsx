import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageWrapper, MainContent } from '../components/layout'
import { Heading, Input, Button, Text } from '../components/ui'
import '../styles/forms.css'
import { request } from '../services/api'
import { supabase } from '../services/supabase'
import { addGroupEvent } from '../services/groups'
import * as eventsService from '../services/events'
import { getCategories } from '../services/events'

const CreateEvent: React.FC = () => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [capacity, setCapacity] = useState<number | ''>('')
  const [closeDate, setCloseDate] = useState('')
  const [fee, setFee] = useState<number | ''>('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<Array<{ id: string | number; name: string }>>([])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const groupId = searchParams.get('groupId')
  const editEventId = searchParams.get('editEventId')

  // Fetch categories on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await getCategories()
        setCategories(res?.categories || [])
      } catch {
        setCategories([])
      }
    }
    loadCategories()
  }, [])

  // Load event data if editing
  useEffect(() => {
    if (editEventId) {
      const loadEventData = async () => {
        setInitialLoading(true)
        try {
          const eventData = await eventsService.getEventById(editEventId)
          if (eventData) {
            setIsEditing(true)
            setTitle(eventData.title || '')
            setDescription(eventData.description || '')
            setLocationName(eventData.location || '')
            setLocationAddress(eventData.location || '')
            setCapacity(eventData.capacity || '')
            setFee(eventData.fee || '')
            setPhotoPreview(eventData.thumbnail || null)
            setCategory(eventData.category || '')

            if (eventData.date) {
              const date = new Date(eventData.date)
              setStartTime(date.toISOString().slice(0, 16))
            }
            if (eventData.closeDate) {
              const closeDate = new Date(eventData.closeDate)
              setCloseDate(closeDate.toISOString().split('T')[0])
            }
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load event data.')
        } finally {
          setInitialLoading(false)
        }
      }
      loadEventData()
    }
  }, [editEventId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setPhotoFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setPhotoPreview(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0] || null
    if (file && file.type.startsWith('image/')) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleCreate = async () => {
    setError('')
    setMessage('')

    if (!title.trim()) { setError('Event title is required.'); return }
    if (!startTime) { setError('Start time is required.'); return }

    setLoading(true)
    try {
      let imageUrl: string | undefined

      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('event-images').upload(fileName, photoFile)
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)
        const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      }

      const body: Record<string, any> = {
        title: title.trim(),
        start_time: new Date(startTime).toISOString(),
      }
      if (description.trim()) body.description = description.trim()
      if (locationName.trim()) body.location_name = locationName.trim()
      if (locationAddress.trim()) body.location_address = locationAddress.trim()
      if (endTime) body.end_time = new Date(endTime).toISOString()
      if (capacity !== '') body.capacity = capacity
      if (closeDate) body.close_date = new Date(closeDate).toISOString()
      body.fee = fee !== '' ? fee : 0
      if (imageUrl) body.image_url = imageUrl
      if (category) body.category = category

      let result
      if (isEditing && editEventId) {
        result = await eventsService.modifyEvent(editEventId, body)
        setMessage('Event updated successfully!')
      } else {
        result = await request('/events/create', { method: 'POST', body })
        if (groupId && result?.event_id) await addGroupEvent(groupId, result.event_id)
        setMessage('Event created successfully!')
      }

      const redirectTo = isEditing ? `/events/${editEventId}` : groupId ? `/groups/${groupId}` : '/events'
      setTimeout(() => navigate(redirectTo), 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to save event.')
    } finally {
      setLoading(false)
    }
  }

  const clearPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <PageWrapper>
      <MainContent>
        <button type="button" className="back-link" onClick={() => navigate(-1)}>‹ Back</button>
        <div className="form-head">
          <h1>{isEditing ? 'Edit event' : groupId ? 'Create group event' : 'Create an event'}</h1>
          <p className="muted">
            {groupId && !isEditing ? 'This event will be linked to your group.' : 'Fill in the basics. You can edit it later.'}
          </p>
        </div>

        {initialLoading ? (
          <div className="card form-section"><Heading level={2}>Loading event...</Heading></div>
        ) : (
          <div className="form-layout">
            <div className="form-main">
              <section className="card form-section">
                <h2>Basics</h2>
                <Input label="Event title *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday comedy night at the Funny Bone" />
                <div>
                  <label className="input-label" htmlFor="description">Description</label>
                  <textarea id="description" className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should people know?" />
                </div>
                <div>
                  <span className="input-label">Category</span>
                  <div className="pills pills--wrap" role="radiogroup" aria-label="Category">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        role="radio"
                        aria-checked={category === cat.name}
                        className={category === cat.name ? 'pill on' : 'pill'}
                        onClick={() => setCategory(category === cat.name ? '' : cat.name)}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card form-section">
                <h2>When &amp; where</h2>
                <div className="form-two">
                  <div>
                    <label className="input-label" htmlFor="start-time">Starts *</label>
                    <input id="start-time" className="input" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div>
                    <label className="input-label" htmlFor="end-time">Ends</label>
                    <input id="end-time" className="input" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>
                <Input label="Place" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. Ohio Union" />
                <Input label="Address" value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} placeholder="e.g. 1739 N High St, Columbus, OH" />
              </section>

              <section className="card form-section">
                <h2>Spots &amp; price</h2>
                <div className="form-two">
                  <Input label="Capacity" type="number" value={capacity as any} onChange={(e) => setCapacity(e.target.value ? Number(e.target.value) : '')} placeholder="Leave empty for no limit" />
                  <Input label="Fee ($)" type="number" value={fee as any} onChange={(e) => setFee(e.target.value ? Number(e.target.value) : '')} placeholder="0 for free" />
                </div>
                <div>
                  <label className="input-label" htmlFor="close-date">RSVP closes</label>
                  <input id="close-date" className="input" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
                </div>
              </section>
            </div>

            <aside className="form-side">
              <span className="input-label">Cover photo</span>
              <div
                className={`dropzone ${photoPreview ? 'has-photo' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click() }}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="Cover preview" />
                    <button type="button" className="dropzone-remove" onClick={clearPhoto}>Remove</button>
                  </>
                ) : (
                  <div className="dropzone-empty">
                    <span aria-hidden="true">🖼️</span>
                    <strong>Add a cover photo</strong>
                    <span className="muted">Click or drop an image · PNG, JPG, WEBP up to 5MB</span>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </div>
              <p className="preview-title">{title.trim() || 'Your event title'}</p>
              <p className="muted preview-meta">
                {[startTime ? new Date(startTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date', locationName.trim() || 'Place'].join(' · ')}
              </p>

              <div className="form-submit">
                <Button onClick={handleCreate} disabled={loading || initialLoading}>
                  {loading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save changes' : 'Create event')}
                </Button>
                <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
              </div>
              {error ? <Text as="p" className="error-text">{error}</Text> : null}
              {message ? <Text as="p" className="status-active">{message}</Text> : null}
            </aside>
          </div>
        )}
      </MainContent>
    </PageWrapper>
  )
}

export default CreateEvent