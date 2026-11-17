import React from 'react'
import { Link } from 'react-router-dom'
import '../../styles/layout.css'
import { Container } from '../ui'

type PageWrapperProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
  className?: string
}

const PageWrapper: React.FC<PageWrapperProps> = ({ children, className = '', ...rest }) => {
  return (
    <div className={`page-wrapper ${className}`.trim()} {...rest}>
      <Container>
        {children}
        <footer className="site-footer"><Link to="/privacy">Privacy</Link></footer>
      </Container>
    </div>
  )
}

export default PageWrapper
