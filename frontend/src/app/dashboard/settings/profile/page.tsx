"use client";

import { FormEvent, useEffect, useState } from "react";
import Alert from "@/components/common/alert";
import Spinner from "@/components/common/spinner";
import ProfileSummary from "@/components/settings/profile-summary";
import ResetPasswordForm from "@/components/settings/reset-password-form";
import { apiRequest } from "@/lib/api";
import { getAuthSession } from "@/lib/auth-session";

type ProfileData = {
  email: string;
  role: string | null;
};

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setFetching(true);
      const session = getAuthSession();

      if (!session?.email) {
        setIsError(true);
        setMessage("No active session found");
        setFetching(false);
        return;
      }

      try {
        const result = await apiRequest<ProfileData>(
          `/api/v1/profile?email=${encodeURIComponent(session.email)}`,
          { method: "GET" },
        );

        if (!result.success || !result.data) {
          setIsError(true);
          setMessage(result.message || "Failed to load profile");
          return;
        }

        setProfile(result.data);
      } catch {
        setIsError(true);
        setMessage("Unable to load profile");
      } finally {
        setFetching(false);
      }
    }

    void loadProfile();
  }, []);

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = getAuthSession();

    if (!session?.email) {
      setIsError(true);
      setMessage("No active session found");
      return;
    }

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const result = await apiRequest("/api/v1/profile/reset-password", {
        method: "PUT",
        body: JSON.stringify({
          email: session.email,
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      if (!result.success) {
        setIsError(true);
        setMessage(result.message || "Failed to update password");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully");
    } catch {
      setIsError(true);
      setMessage("Unable to update password");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return <Spinner label="Loading profile..." />;
  }

  if (!profile) {
    return message ? <Alert variant="error">{message}</Alert> : null;
  }

  return (
    <div className="space-y-6">
      {message ? <Alert variant={isError ? "error" : "success"}>{message}</Alert> : null}

      <div className="grid items-stretch gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-5">
          <ProfileSummary email={profile.email} role={profile.role} />
        </div>
        <div className="min-w-0 xl:col-span-7">
          <ResetPasswordForm
            loading={loading}
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            onCurrentPasswordChange={setCurrentPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onSubmit={handleResetPassword}
          />
        </div>
      </div>
    </div>
  );
}
