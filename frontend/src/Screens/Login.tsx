import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Button, Heading, Text, Card } from "../components/ui";
import { PageWrapper, MainContent } from "../components/layout";
import useAuth from "../hooks/useAuth"
import { useAuthContext } from "../context/AuthContext"
import '../styles/home.css'

function Login() {
  const navigate = useNavigate();
  const { login, loading, error } = useAuth()
  const { login: setAuth } = useAuthContext()

  // State for inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await login(email, password)
      setAuth(res.token, res.user)
      navigate("/dashboard")
    } catch (err: any) {
      console.error("Login Error:", err)
    }
  }


  return (
    <PageWrapper>
      <MainContent>
        <div className="welcome-page">
          <div className="welcome-panel">
            <div className="welcome-left" aria-hidden="true">
              <img src="/campus_crowd.jpg" alt="" className="welcome-photo" />
              <div className="welcome-caption">
                <span className="eyebrow">Ohio State · Columbus</span>
                <p className="welcome-quote">Find your people.<br />Then go do things.</p>
              </div>
            </div>

            <div className="welcome-right">
              <Card className="login-card">
                <Heading level={1}>Welcome back</Heading>
                <Text as="p" className="muted">Sign in with your Buckeye email.</Text>

                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="form-stack">
                  <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Input label="Password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

                  <Button type="submit" disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </form>

                {error ? <Text as="p" className="error-text">{error}</Text> : null}

                <p className="auth-switch">
                  New here? <button type="button" className="shelf-link" onClick={() => navigate("/create-account")}>Create an account</button>
                </p>
              </Card>
            </div>
          </div>
        </div>
      </MainContent>
    </PageWrapper>
  );
}

export default Login;
