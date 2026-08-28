export function buildOtpTemplate(payload: { otpCode: string; fromName: string; purpose?: "login" | "reset" }) {
  const isReset = payload.purpose === "reset";

  return `
  <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:620px;margin:30px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:#2563eb;padding:28px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${isReset ? "Reset your password" : "OTP Verification"}</h1>
        <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">Fuel Distribution System ${isReset ? "password reset" : "secure sign in"}</p>
      </div>
      <div style="padding:28px 24px;">
        <p style="margin:0 0 14px;color:#0f172a;font-size:15px;">Hello,</p>
        <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.6;">
          ${
            isReset
              ? "Use this one-time password to reset your Fuel Optimizer password. This code expires in 10 minutes."
              : "Use this one-time password to complete your login. This code expires in 10 minutes."
          }
        </p>
        <div style="margin:18px 0;padding:16px;background:#eff6ff;border:1px dashed #2563eb;border-radius:12px;text-align:center;">
          <span style="letter-spacing:8px;font-size:34px;font-weight:700;color:#2563eb;">${payload.otpCode}</span>
        </div>
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
          If you did not request this OTP, please ignore this email.
        </p>
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">Sent by ${payload.fromName}</p>
      </div>
    </div>
  </div>
  `;
}
