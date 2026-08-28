"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Card from "@/components/common/card";
import Input from "@/components/common/input";
import Label from "@/components/common/label";

type ResetPasswordFormProps = {
  loading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
};

export default function ResetPasswordForm({
  loading,
  onSubmit,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
}: ResetPasswordFormProps) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <Card className="h-full">
      <div className="flex h-full min-h-[22rem] flex-col">
        <div className="mb-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Reset password</h2>
          <p className="mt-1 text-sm text-muted">Choose a new password for this account.</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <div className="space-y-5">
            <div>
              <Label htmlFor="currentPassword">Current password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => onCurrentPasswordChange(e.target.value)}
                  className="pr-16"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
                >
                  {showCurrent ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="newPassword">New password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => onNewPasswordChange(e.target.value)}
                    className="pr-16"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((prev) => !prev)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
                  >
                    {showNew ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => onConfirmPasswordChange(e.target.value)}
                    className="pr-16"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
                  >
                    {showConfirm ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto flex justify-end border-t border-border pt-5">
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
