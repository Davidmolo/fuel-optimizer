import { env } from "../../../config/env";
import { createMailTransporter, requireEmailConfig } from "../../mail-config/services/mail-config.service";
import type { AccountRole } from "../../role/constants";

const INVITE_EXPIRY_DAYS = 7;

export function getFrontendBaseUrl() {
  return (env.FRONTEND_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function buildInvitationUrl(token: string) {
  return `${getFrontendBaseUrl()}/invite?token=${encodeURIComponent(token)}`;
}

export function buildInvitationEmailTemplate(payload: {
  inviteUrl: string;
  role: AccountRole;
  invitedByEmail: string;
  fromName: string;
}) {
  const roleLabel = payload.role === "admin" ? "Admin" : "User";

  return `
  <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:620px;margin:30px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:#2563eb;padding:28px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">You're invited</h1>
        <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">Fuel Distribution System workspace access</p>
      </div>
      <div style="padding:28px 24px;">
        <p style="margin:0 0 14px;color:#0f172a;font-size:15px;">Hello,</p>
        <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.6;">
          ${payload.invitedByEmail} invited you to Fuel Optimizer as <strong>${roleLabel}</strong>.
          Create your password to join. This invitation expires in ${INVITE_EXPIRY_DAYS} days.
        </p>
        <div style="margin:22px 0;text-align:center;">
          <a href="${payload.inviteUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;">
            Accept invitation
          </a>
        </div>
        <p style="margin:0 0 10px;color:#64748b;font-size:13px;line-height:1.6;">
          Or copy this link into your browser:
        </p>
        <p style="margin:0;word-break:break-all;color:#2563eb;font-size:12px;line-height:1.6;">${payload.inviteUrl}</p>
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">Sent by ${payload.fromName}</p>
      </div>
    </div>
  </div>
  `;
}

export type InvitationEmailPayload = {
  email: string;
  token: string;
  role: AccountRole;
  invitedByEmail: string;
};

export async function sendInvitationEmail(payload: InvitationEmailPayload) {
  const emailConfig = requireEmailConfig();
  const transporter = createMailTransporter(emailConfig);
  const inviteUrl = buildInvitationUrl(payload.token);

  await transporter.sendMail({
    from: `"${emailConfig.fromName}" <${emailConfig.username}>`,
    to: payload.email,
    subject: "You're invited to Fuel Optimizer",
    html: buildInvitationEmailTemplate({
      inviteUrl,
      role: payload.role,
      invitedByEmail: payload.invitedByEmail,
      fromName: emailConfig.fromName,
    }),
  });
}
