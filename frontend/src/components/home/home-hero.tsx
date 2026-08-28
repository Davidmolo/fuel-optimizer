import CounterPanel from "@/components/home/counter-panel";

export default function HomeHero() {
  return (
    <section className="grid w-full gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
      <div className="space-y-4">
        <span className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
          Frontend Foundation
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Next.js + Tailwind + Redux Toolkit starter
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          This project now has a scalable architecture with reusable UI components, a centralized Redux store, typed
          hooks, and feature-based state slices.
        </p>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">
            Recommended folders: <strong>components</strong>, <strong>store</strong>, <strong>lib</strong>,{" "}
            <strong>types</strong>, and feature slices under <strong>store/features</strong>.
          </p>
        </div>
      </div>
      <CounterPanel />
    </section>
  );
}
