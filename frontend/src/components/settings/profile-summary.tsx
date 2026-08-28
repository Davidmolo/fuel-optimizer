import Card from "@/components/common/card";
import { IconMail, IconSettings } from "@/components/common/icons";

type ProfileSummaryProps = {
  email: string;
  role: string | null;
};

function emailInitial(email: string) {
  return email.trim().charAt(0).toUpperCase() || "?";
}

function emailDisplayName(email: string) {
  const local = email.split("@")[0]?.trim();
  return local || email;
}

export default function ProfileSummary({ email, role }: ProfileSummaryProps) {
  const roleLabel = role ?? "user";

  return (
    <Card className="h-full">
      <div className="flex h-full min-h-[22rem] flex-col">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-lg font-semibold text-white shadow-[0_8px_18px_rgba(60,80,224,0.35)]">
            {emailInitial(email)}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Account profile</h2>
            <p className="mt-1 text-sm text-muted">Signed-in account used across the dashboard.</p>
          </div>
        </div>

        <div className="mt-6 rounded-[var(--radius-xl)] border border-border-subtle bg-surface-muted px-5 py-5">
          <p className="truncate text-xl font-semibold tracking-tight text-foreground">{emailDisplayName(email)}</p>
          <p className="mt-1 truncate text-sm text-muted">{email}</p>
          <div className="mt-4">
            <span className="kpi-badge kpi-badge-info capitalize">{roleLabel}</span>
          </div>
        </div>

        <dl className="mt-5 space-y-3">
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border-subtle px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-muted text-primary">
              <IconMail />
            </span>
            <div className="min-w-0 flex-1">
              <dt className="stat-label">Email</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">{email}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border-subtle px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-muted text-primary">
              <IconSettings />
            </span>
            <div className="min-w-0 flex-1">
              <dt className="stat-label">Role</dt>
              <dd className="mt-0.5 text-sm font-semibold capitalize text-primary">{roleLabel}</dd>
            </div>
          </div>
        </dl>

        <p className="mt-auto pt-6 text-sm leading-relaxed text-muted">
          Password changes apply only to this account. Use a unique password you do not reuse elsewhere.
        </p>
      </div>
    </Card>
  );
}
