import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifyToken } from "../services/auth";
import { PageWrapper, MainContent } from "../components/layout"
import { Heading, Text, Button } from "../components/ui"
import { useAuthContext } from "../context/AuthContext"
import "../styles/home.css"

const Verify: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<string>("Verifying your account...");
  const [verified, setVerified] = useState(false)
  const token = searchParams.get("token");
  const userEmail = searchParams.get("user_email");
  const navigate = useNavigate();
  const { login: setAuth } = useAuthContext()

  useEffect(() => {
    if (!token || !userEmail) {
      setStatus("No token found in the URL.");
      return;
    }

    const verify = async () => {
      try {
        const data = await verifyToken(token, userEmail);
        if (data.token) {
          setAuth(data.token, data.user)
          setStatus("Account verified successfully!")
          setVerified(true)
        } else {
          setStatus(data.message || "Verification failed.")
        }
      } catch (error: any) {
        setStatus(error?.message || "Could not connect to the verification server.");
      }
    };

    verify();
  }, [token, userEmail, navigate]);

  return (
    <PageWrapper>
      <MainContent>
        <div className="card verify-card">
          <span style={{ fontSize: 32 }} aria-hidden="true">{verified ? '✅' : '✉️'}</span>
          <Heading level={1}>Email verification</Heading>
          <Text as="p">{status}</Text>
          {verified && (
            <Button onClick={() => navigate("/profile")} className="mt-2">
              Set up your profile
            </Button>
          )}
        </div>
      </MainContent>
    </PageWrapper>
  );
};

export default Verify;