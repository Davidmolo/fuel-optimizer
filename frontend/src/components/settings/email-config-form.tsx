"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Card from "@/components/common/card";
import Input from "@/components/common/input";
import Label from "@/components/common/label";

type EmailConfigFormValues = {
  service: string;
  host: string;
  username: string;
  fromName: string;
  password: string;
};

type EmailConfigFormProps = {
  values: EmailConfigFormValues;
  loading: boolean;
  hasPassword: boolean;
  onChange: (field: keyof EmailConfigFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function EmailConfigForm({
  values,
  loading,
  hasPassword,
  onChange,
  onSubmit,
}: EmailConfigFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-base font-semibold tracking-tight text-foreground">SMTP settings</h2>
        <p className="mt-1 text-sm text-muted">Configure outbound email used for OTP delivery.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="service">Mail service</Label>
            <Input id="service" value={values.service} onChange={(e) => onChange("service", e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="host">Mail host</Label>
            <Input id="host" value={values.host} onChange={(e) => onChange("host", e.target.value)} required />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="username">Mail username</Label>
            <Input
              id="username"
              type="email"
              value={values.username}
              onChange={(e) => onChange("username", e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="fromName">From name</Label>
            <Input id="fromName" value={values.fromName} onChange={(e) => onChange("fromName", e.target.value)} required />
          </div>
        </div>

        <div className="max-w-xl">
          <Label htmlFor="password">Mail password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={values.password}
              onChange={(e) => onChange("password", e.target.value)}
              placeholder={hasPassword ? "Leave blank to keep current password" : "Enter mail password"}
              className="pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">
            {hasPassword
              ? "A password is already saved. Enter a new value only to change it."
              : "Password is required for first-time setup."}
          </p>
        </div>

        <div className="flex justify-end border-t border-border pt-5">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save configuration"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
