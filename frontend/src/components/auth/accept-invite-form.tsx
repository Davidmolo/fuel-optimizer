"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Input from "@/components/common/input";
import Label from "@/components/common/label";

type AcceptInviteFormProps = {
  password: string;
  confirmPassword: string;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function AcceptInviteForm({
  password,
  confirmPassword,
  loading,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: AcceptInviteFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="invite-password">Password</Label>
        <div className="relative">
          <Input
            id="invite-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="h-11 pr-16"
            minLength={8}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor="invite-confirm-password">Confirm password</Label>
        <div className="relative">
          <Input
            id="invite-confirm-password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            placeholder="Re-enter password"
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
        {loading ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
