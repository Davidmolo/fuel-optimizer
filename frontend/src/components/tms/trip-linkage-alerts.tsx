import type { TripLinkageIssue } from "@/lib/trip-linkage-status";

type TripLinkageAlertsProps = {
  issues: TripLinkageIssue[];
  compact?: boolean;
};

export default function TripLinkageAlerts({ issues, compact = false }: TripLinkageAlertsProps) {
  if (issues.length === 0) {
    return null;
  }

  if (compact) {
    const primary = issues[0];
    return (
      <p className="text-xs text-amber-800" title={primary.detail}>
        {primary.title}: {primary.action}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div
          key={issue.key}
          className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-3 py-2.5"
        >
          <p className="text-sm font-medium text-amber-950">{issue.title}</p>
          <p className="mt-1 text-xs text-amber-900">{issue.detail}</p>
          <p className="mt-1.5 text-xs font-medium text-amber-950">{issue.action}</p>
        </div>
      ))}
    </div>
  );
}
