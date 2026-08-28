"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Input from "@/components/common/input";
import Label from "@/components/common/label";

type ForgotPasswordEmailFormProps = {
  email: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function ForgotPasswordEmailForm({
  email,
  loading,
  onEmailChange,
  onSubmit,
}: ForgotPasswordEmailFormProps) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          className="h-11"
          required
        />
        <p className="mt-2 text-sm text-muted">We will send a 6-digit code to this inbox if an account exists.</p>
      </div>

      <Button type="submit" disabled={loading} fullWidth className="h-11">
        {loading ? "Sending code..." : "Send reset code"}
      </Button>
    </form>
  );
}

type ForgotPasswordResetFormProps = {
  otp: string;
  newPassword: string;
  confirmPassword: string;
  loading: boolean;
  onOtpChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function ForgotPasswordResetForm({
  otp,
  newPassword,
  confirmPassword,
  loading,
  onOtpChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: ForgotPasswordResetFormProps) {
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="reset-otp">Verification code</Label>
        <Input
          id="reset-otp"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(event) => onOtpChange(event.target.value)}
          placeholder="000000"
          className="h-11 text-center text-base tracking-[0.4em] tabular-nums"
          required
        />
      </div>

      <div>
        <Label htmlFor="reset-new-password">New password</Label>
        <div className="relative">
          <Input
            id="reset-new-password"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(event) => onNewPasswordChange(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="h-11 pr-16"
            minLength={8}
            required
          />
          <button
            type="button"
            onClick={() => setShowNew((prev) => !prev)}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
          >
            {showNew ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor="reset-confirm-password">Confirm new password</Label>
        <div className="relative">
          <Input
            id="reset-confirm-password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            className="h-11 pr-16"
            minLength={8}
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirm((prev) => !prev)}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
          >
            {showConfirm ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <Button type="submit" disabled={loading} fullWidth className="h-11">
        {loading ? "Updating password..." : "Reset password"}
      </Button>
    </form>
  );
}
