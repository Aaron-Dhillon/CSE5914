import React from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper, MainContent } from '../components/layout'
import '../styles/profile.css'

const REPO_URL = 'https://github.com/Aaron-Dhillon/CSE5914'

const Privacy: React.FC = () => {
  const navigate = useNavigate()
  return (
    <PageWrapper>
      <MainContent>
        <button type="button" className="back-link" onClick={() => navigate(-1)}>‹ Back</button>
        <article className="card profile-panel privacy" style={{ marginTop: 12, marginBottom: 72 }}>
          <h1>Privacy policy</h1>
          <p className="muted">Last updated November 17, 2026</p>
          <p>
            GroupGetter is a student project from Ohio State's CSE 5914 capstone. It helps students find events,
            join groups and get event suggestions. This page explains what we collect and who we share it with.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>Your account: your Ohio State email and a scrambled (hashed) version of your password, never the password itself.</li>
            <li>Your profile: display name, bio, major, graduation year, whether you have a car, and your interests and preferred times.</li>
            <li>What you do here: events and groups you create, join or request to join, and who you follow.</li>
            <li>Photos you upload for an event or group.</li>
            <li>Messages you send to the event assistant. We don't save chat history; it lives in your browser tab.</li>
            <li>Short-lived technical data, such as counts of your recent chat messages and sign-in attempts, kept in server memory to stop abuse.</li>
          </ul>

          <h2>How we use AI</h2>
          <p>
            The event assistant and personalized suggestions are written by AI from OpenAI. When you chat, your
            messages, your interests and a list of upcoming events are sent to OpenAI to write a reply. OpenAI's
            moderation check also reviews your message for safety. AI can be wrong, so check event details before you go.
          </p>

          <h2>Who we share data with</h2>
          <ul>
            <li><strong>Supabase</strong> stores our database and uploaded photos.</li>
            <li><strong>Vercel</strong> hosts the website and server, and keeps standard technical logs (such as IP address and time) for a limited time.</li>
            <li><strong>OpenAI</strong> writes the assistant's replies and suggestions, as described above.</li>
            <li><strong>Ticketmaster</strong> supplies public event listings. We only receive events from it; we never send it anything about you.</li>
          </ul>
          <p>We don't sell your data or show ads.</p>

          <h2>What's public</h2>
          <p>
            Signed-in students can see your profile, interests, follower counts and the events you create. Photos
            you upload are stored at public links, so anyone with the link can view them. Don't upload anything private.
          </p>

          <h2>How long we keep it</h2>
          <p>
            Your account and what you've created stay until you delete them. When you delete an event or group, its
            uploaded photo is deleted too. Deleting your account removes your profile, preferences, follows, the events
            and groups you created (with their photos) and your spot in other groups and events, right away.
          </p>

          <h2>Your choices</h2>
          <p>
            You can edit your profile any time, and delete your account from your profile page. To get a copy of your
            data, contact the team through our <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub page</a>.
          </p>

          <h2>If you're struggling</h2>
          <p>
            If you're thinking about hurting yourself, call or text 988 (Suicide & Crisis Lifeline, US), or call Ohio
            State's Counseling and Consultation Service at 614-292-5766, any time. In an emergency, call 911.
          </p>
        </article>
      </MainContent>
    </PageWrapper>
  )
}

export default Privacy
