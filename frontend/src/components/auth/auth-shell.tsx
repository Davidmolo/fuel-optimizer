import { IconFuel } from "@/components/common/icons";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="app-shell flex min-h-dvh items-center justify-center overflow-y-auto px-4 py-10">
      <div className="w-full max-w-[480px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-white shadow-[0_8px_18px_rgba(60,80,224,0.35)]">
            <IconFuel className="h-6 w-6" />
          </div>
          <p className="text-[0.9375rem] font-semibold tracking-tight text-foreground">Fuel Optimizer</p>
          <p className="mt-0.5 text-[0.6875rem] text-muted">Distribution System</p>
          <h1 className="mt-5 text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
        </div>

        <div className="card-surface rounded-2xl p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
