import Link from 'next/link';
import {
  cloudflareAccount,
  cloudflareMachineRegistry,
  machineHealthCounts,
  type MachineHealth,
} from '@/deployments/cloudflare-machine-registry';

const healthStyle: Record<MachineHealth, string> = {
  operational: 'bg-emerald-400/15 text-emerald-300',
  partial: 'bg-amber-400/15 text-amber-300',
  legacy: 'bg-slate-400/15 text-slate-300',
  unknown: 'bg-red-400/15 text-red-300',
};

export default function MachineStatusPage() {
  const counts = machineHealthCounts();

  return (
    <main className="min-h-screen bg-[#050711] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/builder" className="text-sm font-bold text-cyan-300 hover:text-white">
            ← Infinity Builder
          </Link>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/55">
            Technical dashboard · Cloudflare API snapshot
          </span>
        </nav>

        <section className="rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-950/70 via-[#0b1228] to-violet-950 p-6 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">C13b0 machine status</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-6xl">Infrastructure without pretending.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/65">
            A deployment is only one piece of a machine. C13b0 records its repository, bindings,
            capabilities, evidence, and verification state before calling it operational.
          </p>
          <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(counts).map(([health, count]) => (
              <div key={health} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <dt className="text-xs uppercase tracking-wider text-white/45">{health}</dt>
                <dd className="mt-1 text-3xl font-black">{count}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/[.045] p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Connected account</p>
              <h2 className="mt-2 text-2xl font-black">{cloudflareAccount.label}</h2>
            </div>
            <code className="text-xs text-white/45">IDs retained outside public source</code>
          </div>

          <div className="mt-6 space-y-4">
            {cloudflareMachineRegistry.map(machine => (
              <article key={machine.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">{machine.id}</h3>
                    <p className="mt-1 text-sm text-white/45">{machine.publicHost}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${healthStyle[machine.health]}`}>
                    {machine.health}
                  </span>
                </div>
                <p className="mt-4 leading-7 text-white/65">{machine.healthReason}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-white/[.04] p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/40">Repositories</p>
                    <p className="mt-2 text-sm text-white/70">{machine.repositories.join(' · ') || 'No canonical repository mapped'}</p>
                  </div>
                  <div className="rounded-xl bg-white/[.04] p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/40">Bindings</p>
                    <p className="mt-2 text-sm text-white/70">{machine.bindings.map(binding => `${binding.name} (${binding.type})`).join(' · ') || 'No bindings'}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-violet-400/20 bg-violet-400/[.06] p-5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Action-token page engine</p>
          <h2 className="mt-2 text-2xl font-black">Conversation becomes connected production.</h2>
          <p className="mt-4 max-w-4xl leading-7 text-white/65">
            Chat, search, research, decisions, routes, builds, and publication become linked tokens.
            The background builder updates the owning repository-machine, verifies a preview, records
            a receipt, and adds the result to the Crown Index and daily visual timeline.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Blue', 'Input and import'],
              ['Pink · Yellow', 'Search and research'],
              ['Orange · Red', 'Decision and route'],
              ['Green · Purple', 'Build and assimilation'],
            ].map(([color, purpose]) => (
              <div key={color} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="font-black">{color}</p>
                <p className="mt-1 text-sm text-white/50">{purpose}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
