import Link from 'next/link';
import {
  bitcoinCrusherIdentity,
  bitcoinCrusherPlan,
  bitcoinCrusherScan,
} from '@/builder/auto-builder';

const stageLabels = {
  scan: 'Scan',
  shape: 'Shape',
  fatten: 'Build out',
  format: 'Format',
  verify: 'Verify',
  publish: 'Publish',
};

export default function BuilderPage() {
  return (
    <main className="min-h-screen bg-[#050711] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-bold text-violet-300 hover:text-white">
            ← Infinity OS
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/machine-status" className="rounded-full border border-cyan-400/20 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10">
              Machine status
            </Link>
            <Link href="/crown-index" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/75 hover:bg-white/10">
              Open Crown Index
            </Link>
          </div>
        </nav>

        <section className="relative overflow-hidden rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-violet-950 via-[#0b1228] to-amber-950/60 p-6 shadow-2xl sm:p-10">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
          <p className="relative text-xs font-black uppercase tracking-[.28em] text-amber-300">Infinity Builder Agent</p>
          <h1 className="relative mt-3 max-w-4xl text-4xl font-black tracking-[-.05em] sm:text-6xl">
            Turn every prototype into a finished product.
          </h1>
          <p className="relative mt-5 max-w-3xl text-lg leading-8 text-white/70">
            Crown Index finds the project. The Builder scans its real files, shapes its identity,
            builds out missing pages, formats the experience, validates the result, and prepares a reviewed release.
          </p>
          <div className="relative mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(stageLabels).map(([id, label], index) => (
              <div key={id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-xs font-bold text-violet-300">0{index + 1}</div>
                <div className="mt-1 font-bold">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-[1.75rem] border border-white/10 bg-white/[.045] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">First live blueprint</p>
                <h2 className="mt-2 text-3xl font-black">{bitcoinCrusherIdentity.productName}</h2>
                <p className="mt-2 max-w-2xl text-white/65">{bitcoinCrusherIdentity.tagline}</p>
              </div>
              <span className="rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300">
                {bitcoinCrusherScan.score}/100 · {bitcoinCrusherScan.maturity}
              </span>
            </div>

            <dl className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-black/25 p-4">
                <dt className="text-xs uppercase tracking-wider text-white/45">Code source</dt>
                <dd className="mt-1 font-semibold">{bitcoinCrusherIdentity.repositoryFullName}</dd>
              </div>
              <div className="rounded-2xl bg-black/25 p-4">
                <dt className="text-xs uppercase tracking-wider text-white/45">Suggested public identity</dt>
                <dd className="mt-1 text-xl font-black text-amber-300">{bitcoinCrusherIdentity.suggestedDomain}</dd>
                <p className="mt-1 text-xs text-white/45">Suggestion only; ownership and DNS still require verification.</p>
              </div>
            </dl>

            <h3 className="mt-8 text-lg font-black">Priority build queue</h3>
            <div className="mt-4 space-y-3">
              {bitcoinCrusherPlan.actions.map(action => (
                <div key={action.id} className="flex gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <span className={"h-fit rounded-lg px-2.5 py-1 text-xs font-black " +
                    (action.priority === 'P0' ? 'bg-red-400/15 text-red-300' : action.priority === 'P1' ? 'bg-amber-400/15 text-amber-300' : 'bg-violet-400/15 text-violet-300')}>
                    {action.priority}
                  </span>
                  <div>
                    <p className="font-bold">{action.title}</p>
                    <p className="mt-1 text-sm text-white/55">{stageLabels[action.stage]} · {action.area}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-6">
            <section className="rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/[.06] p-6">
              <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Release gate</p>
              <h2 className="mt-2 text-2xl font-black">The builder improves continuously. Publishing stays controlled.</h2>
              <ul className="mt-5 space-y-3 text-sm text-white/70">
                {['Tests pass', 'Production build passes', 'Browser checks pass', 'Security is reviewed', 'Owner approves the release'].map(item => (
                  <li key={item} className="flex gap-3"><span className="text-emerald-300">✓</span>{item}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/[.045] p-6">
              <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Identity rule</p>
              <p className="mt-3 leading-7 text-white/70">
                Repository names are durable technical addresses. Product names, domains, taglines,
                navigation labels, and visual systems are polished public identities layered above them.
              </p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
