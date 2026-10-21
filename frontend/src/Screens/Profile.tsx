import React, { useEffect, useState } from 'react'
import { PageWrapper, MainContent } from '../components/layout'
import { Button, Input, Text } from '../components/ui'
import '../styles/profile.css'
import { getProfile, updateProfile } from '../services/auth'
import { useAuthContext } from '../context/AuthContext'
import { getCategories, type CategoryItem } from '../services/events'
import {
  getCategoryPreferences,
  getUserPreferences,
  saveCategoryPreferences,
  saveUserPreferences,
} from '../services/preferences'

const Profile: React.FC = () => {
  const bioCharacterLimit = 280
  const graduationYearOptions = Array.from({ length: 8 }, (_, index) => String(new Date().getFullYear() + index))
  
  // Settings/Preferences constants
  const travelDistanceOptions = ['On campus', 'Short commute', 'Anywhere']
  const eventSizeLabels = ['Small (1-30)', 'Medium (31-150)', 'Large (151-500)', 'Mega (500+)']
  const eventSizeValues = ['small', 'medium', 'large', 'mega'] as const
  const eventTimeOptions = [
    {
      group: 'Weekdays',
      options: [
        { label: 'Mornings', value: 'Weekday mornings', id: 0 },
        { label: 'Afternoons', value: 'Weekday afternoons', id: 1 },
        { label: 'Evenings', value: 'Weekday evenings', id: 2 },
      ],
    },
    {
      group: 'Weekends',
      options: [
        { label: 'Mornings', value: 'Weekend mornings', id: 3 },
        { label: 'Afternoons', value: 'Weekend afternoons', id: 4 },
        { label: 'Evenings', value: 'Weekend evenings', id: 5 },
      ],
    },
  ]

  // Profile states
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [major, setMajor] = useState('')
  const [hasCar, setHasCar] = useState(true)
  const [bio, setBio] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  
  // Preferences states
  const [preferenceMessage, setPreferenceMessage] = useState('')
  const [interests, setInterests] = useState<Array<string | number>>([])
  const [interestOptions, setInterestOptions] = useState<CategoryItem[]>([])
  const [travelDistance, setTravelDistance] = useState('Anywhere')
  const [eventSize, setEventSize] = useState(4)
  const [eventTimes, setEventTimes] = useState<number[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoryError, setCategoryError] = useState('')

  const { user } = useAuthContext()
  const requiredFilled = displayName.trim() !== '' && major.trim() !== '' && graduationYear !== ''

  // Load profile and preferences
  useEffect(() => {
    if (!user?.user_id) {
      userId && setUserId('')
      setError('No logged-in user found. Please log in again.')
      setLoading(false)
      return
    }

    let isMounted = true

    async function loadData() {
      try {
        const [profile, categoriesData, categoryPreferencesData, userPreferencesData] = await Promise.all([
          getProfile(user!.user_id),
          getCategories(),
          getCategoryPreferences(user!.user_id),
          getUserPreferences(user!.user_id),
        ])
        
        if (!isMounted) return

        // Load profile data
        setUserId(profile.id)
        setEmail(profile.email ?? '')
        setIsVerified(Boolean(profile.verified))
        setDisplayName(profile.display_name ?? '')
        setBirthDate(profile.birth_date ?? '')
        setGraduationYear(profile.graduation_year != null ? String(profile.graduation_year) : '')
        setMajor(profile.major ?? '')
        setHasCar(Boolean(profile.has_car))
        setBio(profile.bio ?? '')

        // Load preference data
        setInterestOptions(categoriesData.categories)
        setInterests(categoryPreferencesData.category_ids)
        setEventSize(eventSizeValues.indexOf(userPreferencesData.event_size) + 1 || 4)
        setTravelDistance(travelDistanceOptions[userPreferencesData.event_distance] ?? 'Anywhere')
        setEventTimes(userPreferencesData.event_times ?? [])
        
        setError('')
      } catch (err: any) {
        if (!isMounted) return
        setError(err?.message || 'Unable to load profile.')
      } finally {
        if (isMounted) setLoading(false)
        if (isMounted) setLoadingCategories(false)
      }
    }

    loadData()
    return () => { isMounted = false }
  }, [user])

  const toggleInterest = (categoryId: string | number) => {
    setInterests((current) =>
      current.includes(categoryId)
        ? current.filter((item) => item !== categoryId)
        : [...current, categoryId]
    )
  }

  const toggleEventTime = (option: number) => {
    setEventTimes((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    )
  }

  const handleSave = async () => {
    if (!user?.user_id) {
      setError('No logged-in user found. Please log in again.')
      return
    }
    if (!requiredFilled) {
      setShowValidation(true)
      setError('Please fill in all required fields before saving.')
      return
    }

    setSaving(true)
    setSavedMessage('')
    setError('')
    setCategoryError('')
    setPreferenceMessage('')
    setShowValidation(false)

    try {
      // Save profile and preferences in parallel
      const [updatedProfile] = await Promise.all([
        updateProfile({
          id: user!.user_id,
          display_name: displayName,
          birth_date: birthDate || null,
          graduation_year: graduationYear ? Number(graduationYear) : null,
          major,
          has_car: hasCar,
          bio,
        }),
        saveCategoryPreferences({
          user_id: user!.user_id,
          category_ids: interests,
        }),
        saveUserPreferences({
          user_id: user!.user_id,
          event_size: eventSizeValues[eventSize - 1],
          event_distance: travelDistanceOptions.indexOf(travelDistance) as 0 | 1 | 2,
          event_times: eventTimes,
        }),
      ])

      setUserId(updatedProfile.id)
      setEmail(updatedProfile.email ?? '')
      setIsVerified(Boolean(updatedProfile.verified))
      setDisplayName(updatedProfile.display_name ?? '')
      setBirthDate(updatedProfile.birth_date ?? '')
      setGraduationYear(updatedProfile.graduation_year != null ? String(updatedProfile.graduation_year) : '')
      setMajor(updatedProfile.major ?? '')
      setHasCar(Boolean(updatedProfile.has_car))
      setBio(updatedProfile.bio ?? '')
      
      setSavedMessage('Profile and preferences saved successfully!')
    } catch (err: any) {
      setError(err?.message || 'Unable to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const busy = loading || loadingCategories
  const eventSizeShort = ['Small', 'Medium', 'Large', 'Mega']

  return (
    <PageWrapper>
      <MainContent>
        <section className="card profile-head" aria-busy={busy}>
          <div className="profile-banner" aria-hidden="true" />
          <div className="profile-info">
            <div className="profile-avatar" aria-hidden="true">{(displayName.trim().charAt(0) || '?').toUpperCase()}</div>
            <div>
              <h1>
                {displayName.trim() || 'Your profile'}
                <span className={isVerified ? 'profile-badge profile-badge--ok' : 'profile-badge'}>
                  {isVerified ? '● Verified' : 'Not verified'}
                </span>
              </h1>
              <p className="muted">
                {[major.trim(), graduationYear ? `Class of ${graduationYear}` : '', email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          {bio.trim() ? <p className="profile-bio">{bio}</p> : null}
        </section>

        {busy ? <Text as="p" className="muted" style={{ marginTop: 16 }}>Loading profile...</Text> : null}
        {error ? <Text as="p" className="error-text">{error}</Text> : null}
        {categoryError ? <Text as="p" className="error-text">{categoryError}</Text> : null}

        <div className="profile-cols">
          <section className="card profile-panel">
            <h2>Profile details</h2>

            <Input
              label="Display name *"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
            />
            {showValidation && !displayName.trim() ? <p className="field-error">Display name is required.</p> : null}

            <div className="profile-two">
              <div>
                <Input
                  label="Major *"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="Enter your major"
                />
                {showValidation && !major.trim() ? <p className="field-error">Major is required.</p> : null}
              </div>
              <div>
                <label className="input-label" htmlFor="graduation-year">Graduation year *</label>
                <select id="graduation-year" className="input" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)}>
                  <option value="">Select year</option>
                  {graduationYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                {showValidation && !graduationYear ? <p className="field-error">Graduation year is required.</p> : null}
              </div>
            </div>

            <div>
              <label className="input-label" htmlFor="birth-date">Birth date</label>
              <input id="birth-date" type="date" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>

            <div>
              <label className="input-label" htmlFor="profile-bio">Bio</label>
              <textarea
                id="profile-bio"
                className="input profile-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write a short bio others can see..."
                maxLength={bioCharacterLimit}
                rows={4}
              />
              <p className="profile-helper">{bio.length}/{bioCharacterLimit} characters</p>
            </div>

            <div className="profile-toggle">
              <span id="has-car-label">Has a car</span>
              <button
                type="button"
                role="switch"
                aria-checked={hasCar}
                aria-labelledby="has-car-label"
                className={hasCar ? 'switch on' : 'switch'}
                onClick={() => setHasCar((v) => !v)}
              />
            </div>
          </section>

          <section className="card profile-panel">
            <h2>Event preferences</h2>

            <p className="profile-q">What kinds of events interest you most? *</p>
            <div className="profile-chips">
              {interestOptions.map((interest) => {
                const selected = interests.includes(interest.id)
                return (
                  <button
                    key={String(interest.id)}
                    type="button"
                    className={selected ? 'pill on' : 'pill'}
                    aria-pressed={selected}
                    onClick={() => toggleInterest(interest.id)}
                  >
                    {interest.name}
                  </button>
                )
              })}
            </div>

            <p className="profile-q">When are you usually free? *</p>
            <div className="time-grid" role="group" aria-label="Free times">
              <span />
              {eventTimeOptions[0].options.map((o) => <span key={o.label} className="time-head">{o.label}</span>)}
              {eventTimeOptions.map((section) => (
                <React.Fragment key={section.group}>
                  <span className="time-head">{section.group}</span>
                  {section.options.map((option) => {
                    const selected = eventTimes.includes(option.id)
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={selected ? 'time-cell on' : 'time-cell'}
                        aria-pressed={selected}
                        aria-label={option.value}
                        onClick={() => toggleEventTime(option.id)}
                      >
                        {selected ? '✓' : ''}
                      </button>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>

            <p className="profile-q">What size events do you prefer? *</p>
            <div className="segmented" role="radiogroup" aria-label="Event size">
              {eventSizeShort.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={eventSize === i + 1}
                  className={eventSize === i + 1 ? 'on' : ''}
                  onClick={() => setEventSize(i + 1)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="profile-helper">{eventSizeLabels[eventSize - 1]} people</p>

            <p className="profile-q">How far are you willing to travel? *</p>
            <div className="segmented segmented--3" role="radiogroup" aria-label="Travel distance">
              {travelDistanceOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={travelDistance === option}
                  className={travelDistance === option ? 'on' : ''}
                  onClick={() => setTravelDistance(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="profile-save">
          {savedMessage ? <Text as="p" className="status-active">{savedMessage}</Text> : null}
          {preferenceMessage ? <Text as="p" className="status-active">{preferenceMessage}</Text> : null}
          <Button onClick={handleSave} disabled={saving || busy}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </MainContent>
    </PageWrapper>
  )
}

export default Profile