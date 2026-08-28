"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/common/button";
import Input from "@/components/common/input";
import Label from "@/components/common/label";

type LoginFormProps = {
  email: string;
  password: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function LoginForm({
  email,
  password,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          className="h-11"
          required
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <Label htmlFor="password" className="mb-0">
            Password
          </Label>
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:text-primary-hover">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            className="h-11 pr-16"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <Button type="submit" disabled={loading} fullWidth className="mt-1 h-11">
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
