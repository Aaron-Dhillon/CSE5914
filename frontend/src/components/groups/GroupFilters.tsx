import React from 'react'
import { Input } from '../ui'

type Props = {
  search: string
  setSearch: (s: string) => void
  location: string
  setLocation: (l: string) => void
  locations: string[]
  /** extra toolbar controls, e.g. a Create button */
  children?: React.ReactNode
}

const GroupFilters: React.FC<Props> = ({ search, setSearch, location, setLocation, locations, children }) => {
  return (
    <form className="tools" role="search" onSubmit={(e) => e.preventDefault()} aria-label="Group filters">
      <div className="search">
        <label className="visually-hidden" htmlFor="group-search">Search groups</label>
        <Input id="group-search" placeholder="Search groups" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search groups" />
      </div>
      <label className="visually-hidden" htmlFor="group-location">Join policy</label>
        <select id="group-location" className="input" value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Filter groups by join policy">
          <option value="">All groups</option>
        {locations.map((l) => <option key={l} value={l}>{l === 'open' ? 'Open' : 'Approval required'}</option>)}
      </select>
      {children}
    </form>
  )
}

export default GroupFilters
