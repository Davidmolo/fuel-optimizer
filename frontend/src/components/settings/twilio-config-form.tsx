"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Card from "@/components/common/card";
import Input from "@/components/common/input";
import Label from "@/components/common/label";

type TwilioConfigFormValues = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

type TwilioConfigFormProps = {
  values: TwilioConfigFormValues;
  loading: boolean;
  hasAuthToken: boolean;
  onChange: (field: keyof TwilioConfigFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function TwilioConfigForm({
  values,
  loading,
  hasAuthToken,
  onChange,
  onSubmit,
}: TwilioConfigFormProps) {
  const [showToken, setShowToken] = useState(false);

  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Twilio SMS</h2>
        <p className="mt-1 text-sm text-muted">Credentials for SMS notifications and OTP delivery.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="accountSid">Account SID</Label>
            <Input
              id="accountSid"
              value={values.accountSid}
              onChange={(e) => onChange("accountSid", e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
            />
          </div>

          <div>
            <Label htmlFor="authToken">Auth token</Label>
            <div className="relative">
              <Input
                id="authToken"
                type={showToken ? "text" : "password"}
                value={values.authToken}
                onChange={(e) => onChange("authToken", e.target.value)}
                placeholder={hasAuthToken ? "Leave blank to keep current token" : "Enter Twilio auth token"}
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setShowToken((prev) => !prev)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="fromNumber">From number</Label>
            <Input
              id="fromNumber"
              value={values.fromNumber}
              onChange={(e) => onChange("fromNumber", e.target.value)}
              placeholder="+1234567890"
              required
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border pt-5">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Twilio configuration"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
