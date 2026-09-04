"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AcceptInviteForm from "@/components/auth/accept-invite-form";
import AuthShell from "@/components/auth/auth-shell";
import Alert from "@/components/common/alert";
import Spinner from "@/components/common/spinner";
import { apiRequest } from "@/lib/api";
import type { InvitationPreview } from "@/types/account";

function roleLabel(role: string) {
  return role === "admin" ? "admin" : "user";
}

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim().toLowerCase();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!token) {
      setPreviewError("This invitation link is missing a token.");
      setLoadingPreview(false);
      return;
    }

    let cancelled = false;

    async function loadInvitation() {
      setLoadingPreview(true);
      const result = await apiRequest<InvitationPreview>(`/api/v1/auth/invitations/${token}`, {
        method: "GET",
      });

      if (cancelled) {
        return;
      }

      if (!result.success || !result.data) {
        setPreviewError(result.message || "This invitation is invalid or has expired.");
        setPreview(null);
      } else {
        setPreviewError("");
        setPreview(result.data);
      }

      setLoadingPreview(false);
    }

    void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    const result = await apiRequest(`/api/v1/auth/invitations/${token}/accept`, {
      method: "POST",
      body: JSON.stringify({ password, confirmPassword }),
    });

    setLoading(false);

    if (!result.success) {
      setIsError(true);
      setMessage(result.message || "Unable to create your account");
      return;
    }

    setDone(true);
    setMessage(result.message || "Account created. You can now sign in.");
  }

  if (loadingPreview) {
    return (
      <AuthShell title="Checking invitation" subtitle="Hang on while we verify this invite.">
        <div className="flex justify-center py-6">
          <Spinner label="Validating invitation..." />
        </div>
      </AuthShell>
    );
  }

  if (!preview) {
    return (
      <AuthShell title="Invitation unavailable" subtitle="Ask a teammate to send a new invite if you still need access.">
        <Alert variant="error">{previewError}</Alert>
        <p className="mt-5 text-center text-sm text-muted">
          <Link href="/" className="font-medium text-primary hover:text-primary-hover">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={done ? "Account ready" : "Join Fuel Optimizer"}
      subtitle={
        done
          ? "Your password is set. Sign in to continue."
          : `${preview.invitedByEmail ?? "A teammate"} invited you as ${roleLabel(preview.role)}.`
      }
    >
      {done ? (
        <Link
          href="/"
          className="inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-lg)] bg-primary text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Continue to sign in
        </Link>
      ) : (
        <>
          <p className="mb-5 rounded-[var(--radius-lg)] border border-border bg-surface-muted px-3.5 py-2.5 text-sm text-foreground">
            Creating account for <span className="font-medium">{preview.email}</span>
          </p>
          <AcceptInviteForm
            password={password}
            confirmPassword={confirmPassword}
            loading={loading}
            onPasswordChange={setPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onSubmit={handleSubmit}
          />
        </>
      )}

      {message ? (
        <div className="mt-5">
          <Alert variant={isError ? "error" : "success"}>{message}</Alert>
        </div>
      ) : null}

      {!done ? (
        <p className="mt-5 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/" className="font-medium text-primary hover:text-primary-hover">
            Sign in
          </Link>
        </p>
      ) : null}
    </AuthShell>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Checking invitation" subtitle="Hang on while we verify this invite.">
          <div className="flex justify-center py-6">
            <Spinner label="Validating invitation..." />
          </div>
        </AuthShell>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
