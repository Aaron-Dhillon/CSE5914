import { useNavigate } from "react-router-dom";
import { Button, Heading, Text } from "../components/ui";
import { PageWrapper, MainContent } from "../components/layout";
import '../styles/home.css'

function Home() {
  const navigate = useNavigate();

  return (
    <PageWrapper>
      <MainContent>
        <section className="landing">
          <img src="/campus_crowd.jpg" alt="" className="landing-photo" />
          <div className="landing-body">
            <span className="eyebrow">Ohio State · Columbus</span>
            <Heading level={1}>Your week at Ohio State, <span className="accent">sorted.</span></Heading>
            <Text as="p">Concerts, games, shows and student groups near campus, picked for you. Find people to go with.</Text>
            <div className="landing-actions">
              <Button onClick={() => navigate('/create-account')}>Create account</Button>
              <Button variant="ghost" onClick={() => navigate('/login')}>Sign in</Button>
            </div>
          </div>
        </section>

        <section className="landing-points">
          <div className="card"><span aria-hidden="true">🎟️</span><h3>Every event nearby</h3><p>Hundreds of upcoming concerts, games and shows, refreshed daily.</p></div>
          <div className="card"><span aria-hidden="true">✨</span><h3>Picked for you</h3><p>Choose your interests and ask the assistant what to do this week.</p></div>
          <div className="card"><span aria-hidden="true">👥</span><h3>Go together</h3><p>Join groups and see what the people you follow are going to.</p></div>
        </section>
      </MainContent>
    </PageWrapper>
  )
}

export default Home;
