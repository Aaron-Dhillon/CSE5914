import React, { useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth"
import { PageWrapper, MainContent } from "../components/layout"
import { Card, Heading, Input, Button, Text } from "../components/ui"
import '../styles/home.css'

const CreateAccount: React.FC = () => {
  const navigate = useNavigate();
  const { register, loading, error } = useAuth()

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value);
  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);
  const handleConfirmChange = (e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value);

  const handleSignUp = async (): Promise<void> => {
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      const res = await register(email, password)
      if (res && (res as any).message) alert((res as any).message)
      else alert('Account created — please check your email to verify your account.')
      navigate('/login')
    } catch (err: any) {
      console.error('Signup Error:', err)
      alert(err?.message || 'Failed to connect to the backend.')
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
                <Heading level={1}>Create your account</Heading>
                <Text as="p" className="muted">Use your Buckeye email. We’ll send a link to verify it.</Text>

                <div className="form-stack">
                <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={handleEmailChange} />
                <Input label="Password" type="password" placeholder="Password" value={password} onChange={handlePasswordChange} />
                <Input label="Confirm Password" type="password" placeholder="Confirm Password" value={confirmPassword} onChange={handleConfirmChange} />
                </div>

                <Button onClick={handleSignUp} disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</Button>

                {error ? <Text as="p" className="error-text">{error}</Text> : null}

                <p className="auth-switch">
                  Already have an account? <button type="button" className="shelf-link" onClick={() => navigate("/login")}>Sign in</button>
                </p>
              </Card>
            </div>
          </div>
        </div>
      </MainContent>
    </PageWrapper>
  );
};

export default CreateAccount;