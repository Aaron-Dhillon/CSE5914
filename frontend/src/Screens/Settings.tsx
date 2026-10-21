import React, { useEffect, useState } from 'react'
import { PageWrapper, MainContent } from '../components/layout'
import { Button, Text } from '../components/ui'
import { getCategories, type CategoryItem } from '../services/events'
import {
  getCategoryPreferences,
  getUserPreferences,
  saveCategoryPreferences,
  saveUserPreferences,
} from '../services/preferences'
import '../styles/profile.css'

const Settings: React.FC = () => {
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
  const [preferenceMessage, setPreferenceMessage] = useState('')
  const [interests, setInterests] = useState<Array<string | number>>([])
  const [interestOptions, setInterestOptions] = useState<CategoryItem[]>([])
  const [travelDistance, setTravelDistance] = useState('Anywhere')
  const [eventSize, setEventSize] = useState(4)
  const [eventTimes, setEventTimes] = useState<number[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [savingCategories, setSavingCategories] = useState(false)
  const [categoryError, setCategoryError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadCategories() {
      const userId = localStorage.getItem('userId')

      if (!userId) {
        if (isMounted) {
          setCategoryError('No logged-in user found. Please log in again.')
          setLoadingCategories(false)
        }
        return
      }

      try {
        const [categoriesData, categoryPreferencesData, userPreferencesData] = await Promise.all([
          getCategories(),
          getCategoryPreferences(userId),
          getUserPreferences(userId),
        ])
        if (!isMounted) return
        setInterestOptions(categoriesData.categories)
        setInterests(categoryPreferencesData.category_ids)
        setEventSize(eventSizeValues.indexOf(userPreferencesData.event_size) + 1 || 4)
        setTravelDistance(travelDistanceOptions[userPreferencesData.event_distance] ?? 'Anywhere')
        setEventTimes(userPreferencesData.event_times ?? [])
        setCategoryError('')
      } catch (err: any) {
        if (!isMounted) return
        setCategoryError(err?.message || 'Unable to load categories.')
      } finally {
        if (isMounted) setLoadingCategories(false)
      }
    }

    loadCategories()

    return () => {
      isMounted = false
    }
  }, [])

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

  const savePreferences = async () => {
    const userId = localStorage.getItem('userId')

    if (!userId) {
      setCategoryError('No logged-in user found. Please log in again.')
      return
    }

    setSavingCategories(true)
    setPreferenceMessage('')
    setCategoryError('')

    try {
      const [categoryResponse, preferenceResponse] = await Promise.all([
        saveCategoryPreferences({
          user_id: userId,
          category_ids: interests,
        }),
        saveUserPreferences({
          user_id: userId,
          event_size: eventSizeValues[eventSize - 1],
          event_distance: travelDistanceOptions.indexOf(travelDistance) as 0 | 1 | 2,
          event_times: eventTimes,
        }),
      ])
      setPreferenceMessage(preferenceResponse?.message || categoryResponse?.message || 'Preferences saved.')
    } catch (err: any) {
      setCategoryError(err?.message || 'Unable to save preferences.')
    } finally {
      setSavingCategories(false)
    }
  }

  const eventSizeShort = ['Small', 'Medium', 'Large', 'Mega']

  return (
    <PageWrapper>
      <MainContent>
        <div className="form-head" style={{ marginTop: 40 }}>
          <h1 style={{ fontSize: 40, letterSpacing: '-0.03em', margin: 0 }}>Settings</h1>
          <p className="muted">Private preferences that shape your recommendations.</p>
        </div>

        <section className="card profile-panel" style={{ maxWidth: 640, marginBottom: 72 }}>
          <h2>Event preferences</h2>
          {loadingCategories ? <Text as="p" className="muted">Loading categories...</Text> : null}
          {categoryError ? <Text as="p" className="error-text">{categoryError}</Text> : null}

          <p className="profile-q">What kinds of events interest you most?</p>
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

          <p className="profile-q">When are you usually free?</p>
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

          <p className="profile-q">What size events do you prefer?</p>
          <div className="segmented" role="radiogroup" aria-label="Event size">
            {eventSizeShort.map((label, i) => (
              <button key={label} type="button" role="radio" aria-checked={eventSize === i + 1} className={eventSize === i + 1 ? 'on' : ''} onClick={() => setEventSize(i + 1)}>
                {label}
              </button>
            ))}
          </div>
          <p className="profile-helper">{eventSizeLabels[eventSize - 1]} people</p>

          <p className="profile-q">How far are you willing to travel?</p>
          <div className="segmented segmented--3" role="radiogroup" aria-label="Travel distance">
            {travelDistanceOptions.map((option) => (
              <button key={option} type="button" role="radio" aria-checked={travelDistance === option} className={travelDistance === option ? 'on' : ''} onClick={() => setTravelDistance(option)}>
                {option}
              </button>
            ))}
          </div>

          <div className="profile-save" style={{ margin: '12px 0 0' }}>
            {preferenceMessage ? <Text as="p" className="status-active">{preferenceMessage}</Text> : null}
            <Button onClick={savePreferences} disabled={savingCategories || loadingCategories}>
              {savingCategories ? 'Saving...' : 'Save preferences'}
            </Button>
          </div>
        </section>
      </MainContent>
    </PageWrapper>
  )
}

export default Settings
