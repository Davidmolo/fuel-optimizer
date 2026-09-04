"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import LoginForm from "@/components/auth/login-form";
import VerifyOtpForm from "@/components/auth/verify-otp-form";
import Alert from "@/components/common/alert";
import { saveAuthSession } from "@/lib/auth-session";
import { apiUrl } from "@/lib/api";
import { usePersistedJson } from "@/lib/use-persisted-state";

type LoginResponse = {
  success: boolean;
  message: string;
  data?: {
    id: string;
    email: string;
    role: string | null;
    roleId: string;
    otpRequired?: boolean;
  };
};

type VerifyOtpResponse = {
  success: boolean;
  message: string;
  data?: {
    email: string;
    role: string | null;
  };
};

const EMPTY_LOGIN_CREDENTIALS = {
  email: "",
  password: "",
};

export default function Home() {
  const LOGIN_CREDENTIALS_KEY = "fuel_login_credentials";
  const router = useRouter();
  const [credentials, setCredentials] = usePersistedJson(LOGIN_CREDENTIALS_KEY, EMPTY_LOGIN_CREDENTIALS);
  const email = credentials.email;
  const password = credentials.password;
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const normalizedOtp = otp.replace(/\D/g, "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(apiUrl("/api/v1/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = (await response.json()) as LoginResponse;

      if (!response.ok || !result.success) {
        setIsError(true);
        setMessage(result.message || "Login failed");
        return;
      }

      setOtpStep(true);
      setMessage(`A verification code was sent to ${result.data?.email}.`);
    } catch {
      setIsError(true);
      setMessage("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(apiUrl("/api/v1/auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: normalizedOtp }),
      });

      const result = (await response.json()) as VerifyOtpResponse;

      if (!response.ok || !result.success || !result.data) {
        setIsError(true);
        setMessage(result.message || "OTP verification failed");
        return;
      }

      saveAuthSession({
        email: result.data.email,
        role: result.data.role,
      });
      router.push("/dashboard");
    } catch {
      setIsError(true);
      setMessage("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setResendLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(apiUrl("/api/v1/auth/resend-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = (await response.json()) as { success: boolean; message: string };

      if (!response.ok || !result.success) {
        setIsError(true);
        setMessage(result.message || "Failed to resend OTP");
        return;
      }

      setMessage("A new verification code has been sent.");
    } catch {
      setIsError(true);
      setMessage("Unable to connect to server");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <AuthShell
      title={otpStep ? "Verify your identity" : "Welcome back"}
      subtitle={otpStep ? "Check your inbox for the one-time code." : "Sign in to your account"}
    >
      {!otpStep ? (
        <LoginForm
          email={email}
          password={password}
          loading={loading}
          onEmailChange={(value) => setCredentials((prev) => ({ ...prev, email: value }))}
          onPasswordChange={(value) => setCredentials((prev) => ({ ...prev, password: value }))}
          onSubmit={handleSubmit}
        />
      ) : (
        <VerifyOtpForm
          otp={otp}
          loading={loading}
          resendLoading={resendLoading}
          onOtpChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
          onSubmit={handleVerifyOtp}
          onResendOtp={handleResendOtp}
        />
      )}

      {message ? (
        <div className="mt-5">
          <Alert variant={isError ? "error" : "info"}>{message}</Alert>
        </div>
      ) : null}

      {otpStep ? (
        <p className="mt-5 text-center text-sm text-muted">
          <button
            type="button"
            onClick={() => {
              setOtpStep(false);
              setOtp("");
              setMessage("");
              setIsError(false);
            }}
            className="font-medium text-primary hover:text-primary-hover"
          >
            Use a different account
          </button>
        </p>
      ) : null}
    </AuthShell>
  );
}
