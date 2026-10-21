import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper, MainContent } from '../components/layout'
import { Input, Button, Text } from '../components/ui'
import '../styles/forms.css'
import * as groupsService from '../services/groups'
import { supabase } from '../services/supabase'

const CreateGroup: React.FC = () => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [joinPolicy, setJoinPolicy] = useState('open')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const navigate = useNavigate()

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

    if (!name.trim()) {
      setError('Group name is required.')
      return
    }

    setLoading(true)
    try {
      let imageUrl: string | undefined

      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(fileName, photoFile)

        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)

        const { data: urlData } = supabase.storage
          .from('event-images')
          .getPublicUrl(fileName)

        imageUrl = urlData.publicUrl
      }

      await groupsService.createGroup({
        name: name.trim(),
        join_policy: joinPolicy,
        description: description.trim() || undefined,
        image_url: imageUrl,
      })

      setMessage('Group created successfully!')
      setTimeout(() => navigate('/groups'), 1500)
    } catch (err: any) {
      setError(err?.message || 'Failed to create group.')
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

  const policies = [
    { value: 'open', title: 'Open', desc: 'Anyone can join right away.' },
    { value: 'approval', title: 'Approval required', desc: 'You approve each request.' },
  ]

  return (
    <PageWrapper>
      <MainContent>
        <button type="button" className="back-link" onClick={() => navigate(-1)}>‹ Back</button>
        <div className="form-head">
          <h1>Create a group</h1>
          <p className="muted">Bring people together around the things you like doing.</p>
        </div>

        <div className="form-layout">
          <div className="form-main">
            <section className="card form-section">
              <h2>About the group</h2>
              <Input label="Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Buckeye Concert Crew" />
              <div>
                <label className="input-label" htmlFor="description">Description</label>
                <textarea id="description" className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this group about?" />
              </div>
            </section>

            <section className="card form-section">
              <h2>Who can join?</h2>
              <div className="choice-cards" role="radiogroup" aria-label="Join policy">
                {policies.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={joinPolicy === p.value}
                    className={joinPolicy === p.value ? 'choice-card on' : 'choice-card'}
                    onClick={() => setJoinPolicy(p.value)}
                  >
                    <strong>{p.title}</strong>
                    <span>{p.desc}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="form-side">
            <span className="input-label">Group photo</span>
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
                  <img src={photoPreview} alt="Group photo preview" />
                  <button type="button" className="dropzone-remove" onClick={clearPhoto}>Remove</button>
                </>
              ) : (
                <div className="dropzone-empty">
                  <span aria-hidden="true">🖼️</span>
                  <strong>Add a group photo</strong>
                  <span className="muted">Click or drop an image · PNG, JPG, WEBP up to 5MB</span>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </div>
            <p className="preview-title" style={{ textTransform: 'capitalize' }}>{name.trim() || 'Your group name'}</p>
            <p className="muted preview-meta">{joinPolicy === 'open' ? 'Open group' : 'Approval required'}</p>

            <div className="form-submit">
              <Button onClick={handleCreate} disabled={loading}>{loading ? 'Creating...' : 'Create group'}</Button>
              <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
            {error ? <Text as="p" className="error-text">{error}</Text> : null}
            {message ? <Text as="p" className="status-active">{message}</Text> : null}
          </aside>
        </div>
      </MainContent>
    </PageWrapper>
  )
}

export default CreateGroup
