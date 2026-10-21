import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Container, Button, LazyImage } from '../ui'
import { useAuthContext } from '../../context/AuthContext'
import '../../styles/layout.css'

const TopNav: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, logout } = useAuthContext()
  const disabled = !isAuthenticated

  const handleAuthClick = () => {
    if (!isAuthenticated) {
      navigate('/login')
    } else {
      logout()
      navigate('/')
    }
  }

  return (
    <div className="topnav-wrapper">
      <Container>
        <nav className="topnav" aria-label="Main navigation">
          <div className="topnav-left">
            <NavLink to="/" className="brand" aria-label="GroupGetter home">
              <LazyImage src="/block_o.png" alt="" width={23} height={30} />
              <span className="brand-text">Group<b>Getter</b></span>
            </NavLink>
          </div>

          <div className="topnav-center">
            <ul className="topnav-links">
              <li>
                <NavLink
                  to="/dashboard"
                  onClick={(e) => { if (disabled) e.preventDefault() }}
                  className={({isActive}) => `${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`.trim()}
                >Home</NavLink>
              </li>
              <li>
                <NavLink
                  to="/events"
                  onClick={(e) => { if (disabled) e.preventDefault() }}
                  className={({isActive}) => `${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`.trim()}
                >Events</NavLink>
              </li>
              <li>
                <NavLink
                  to="/groups"
                  onClick={(e) => { if (disabled) e.preventDefault() }}
                  className={({isActive}) => `${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`.trim()}
                >Groups</NavLink>
              </li>
              <li>
                <NavLink
                  to="/profile"
                  onClick={(e) => { if (disabled) e.preventDefault() }}
                  className={({isActive}) => `${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`.trim()}
                >Profile</NavLink>
              </li>
            </ul>
          </div>

          <div className="topnav-right">
            <Button variant={isAuthenticated ? 'ghost' : 'primary'} className="topnav-auth" onClick={handleAuthClick}>
              {isAuthenticated ? 'Sign out' : 'Sign in'}
            </Button>
          </div>
        </nav>
      </Container>
    </div>
  )
}

export default TopNav
