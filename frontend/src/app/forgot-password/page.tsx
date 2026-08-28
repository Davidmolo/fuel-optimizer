"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/auth-shell";
import { ForgotPasswordEmailForm, ForgotPasswordResetForm } from "@/components/auth/forgot-password-form";
import Alert from "@/components/common/alert";

type AuthMessageResponse = {
  success: boolean;
  message: string;
};

export default function ForgotPasswordPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetStep, setResetStep] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = (await response.json()) as AuthMessageResponse;

      if (!response.ok || !result.success) {
        setIsError(true);
        setMessage(result.message || "Unable to send reset code");
        return;
      }

      setResetStep(true);
      setMessage(result.message || "If an account exists, a verification code was sent.");
    } catch {
      setIsError(true);
      setMessage("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          otp: otp.replace(/\D/g, ""),
          newPassword,
          confirmPassword,
        }),
      });

      const result = (await response.json()) as AuthMessageResponse;

      if (!response.ok || !result.success) {
        setIsError(true);
        setMessage(result.message || "Unable to reset password");
        return;
      }

      setDone(true);
      setMessage(result.message || "Password updated successfully. You can sign in with the new password.");
    } catch {
      setIsError(true);
      setMessage("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={done ? "Password updated" : resetStep ? "Choose a new password" : "Forgot password"}
      subtitle={
        done
          ? "You can now sign in with your new password."
          : resetStep
            ? `Enter the code sent to ${email}, then set a new password.`
            : "Enter your email and we will send a reset code."
      }
    >
      {done ? (
        <Link
          href="/"
          className="inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-lg)] bg-primary text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Back to sign in
        </Link>
      ) : !resetStep ? (
        <ForgotPasswordEmailForm
          email={email}
          loading={loading}
          onEmailChange={setEmail}
          onSubmit={handleRequestCode}
        />
      ) : (
        <ForgotPasswordResetForm
          otp={otp}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          loading={loading}
          onOtpChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={handleResetPassword}
        />
      )}

      {message ? (
        <div className="mt-5">
          <Alert variant={isError ? "error" : done ? "success" : "info"}>{message}</Alert>
        </div>
      ) : null}

      {!done ? (
        <p className="mt-5 text-center text-sm text-muted">
          <Link href="/" className="font-medium text-primary hover:text-primary-hover">
            Back to sign in
          </Link>
        </p>
      ) : null}
    </AuthShell>
  );
}
