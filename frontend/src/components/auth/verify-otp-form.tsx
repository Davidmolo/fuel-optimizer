"use client";

import Button from "@/components/common/button";
import Input from "@/components/common/input";
import Label from "@/components/common/label";

type VerifyOtpFormProps = {
  otp: string;
  loading: boolean;
  resendLoading: boolean;
  onOtpChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onResendOtp: () => void;
};

export default function VerifyOtpForm({
  otp,
  loading,
  resendLoading,
  onOtpChange,
  onSubmit,
  onResendOtp,
}: VerifyOtpFormProps) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="otp">Verification code</Label>
        <Input
          id="otp"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(event) => onOtpChange(event.target.value)}
          placeholder="000000"
          className="h-11 text-center text-base tracking-[0.4em] tabular-nums"
          required
        />
        <p className="mt-2 text-sm text-muted">Enter the 6-digit code sent to your email.</p>
      </div>

      <Button type="submit" disabled={loading} fullWidth className="h-11">
        {loading ? "Verifying..." : "Verify & continue"}
      </Button>

      <Button type="button" variant="outline" disabled={resendLoading} fullWidth className="h-11" onClick={onResendOtp}>
        {resendLoading ? "Resending..." : "Resend code"}
      </Button>
    </form>
  );
}
