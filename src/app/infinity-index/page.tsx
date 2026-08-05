'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { portals, repositoryRegistry, type InfinityPortal } from '@/infinity/portal-registry';

const sizeClass: Record<InfinityPortal['scale'], string> = {
  hero: 'md:col-span-2 xl:col-span-7 min-h-[430px]',
  large: 'xl:col-span-5 min-h-[350px]',
  wide: 'md:col-span-2 xl:col-span-8 min-h-[310px]',
  compact: 'xl:col-span-4 min-h-[260px]',
  utility: 'md:col-span-2 xl:col-span-12 min-h-[220px]',
};

export default function InfinityIndexPage() {
  const [expanded, setExpanded] = useState<string | null>('mario-spin');
  const [starred, setStarred] = useState<string[]>(['mario-spin', 'crown-index']);
  const active = useMemo(() => portals.find(portal => portal.id === expanded), [expanded]);

  function toggleStar(id: string) {
    setStarred(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  return (
    <main className="min-h-screen bg-[#04050b] text-white">
      <header className="overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(98,51,255,.35),transparent_34%),radial-gradient(circle_at_88%_5%,rgba(0,220,255,.2),transparent_30%),linear-gradient(180deg,#090b18,#04050b)] px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[.28em] text-cyan-300">C13b0 · Central routing surface</p>
          <div className="mt-3 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <h1 className="max-w-5xl text-5xl font-black tracking-[-.065em] sm:text-7xl lg:text-8xl">Infinity is a world of portals, not a grid of identical apps.</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">Projects survive when they carry a distinct purpose. Shared code moves into common media, design, game, identity, encryption, versioning, and engineering services.</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/[.05] p-5 backdrop-blur">
              <strong className="text-3xl text-amber-300">{portals.length}</strong>
              <p className="mt-1 text-sm text-slate-400">registered portal surfaces</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <span className="rounded-xl bg-emerald-400/10 p-3 text-emerald-200">Strengthen {portals.filter(p=>p.repositoryDecision==='strengthen').length}</span>
                <span className="rounded-xl bg-violet-400/10 p-3 text-violet-200">Merge purpose {portals.filter(p=>p.repositoryDecision==='merge-purpose').length}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="grid auto-rows-auto gap-4 md:grid-cols-2 xl:grid-cols-12">
          {portals.map(portal => {
            const isExpanded = expanded === portal.id;
            const isStarred = starred.includes(portal.id);
            return (
              <article key={portal.id} className={`${sizeClass[portal.scale]} relative overflow-hidden rounded-[30px] border ${isExpanded?'border-white/40':'border-white/10'} bg-gradient-to-br ${portal.accent} p-[1px] shadow-2xl shadow-black/30`}>
                <div className="flex h-full flex-col rounded-[29px] bg-[#080a14]/92 p-6 backdrop-blur-xl sm:p-8">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest">{portal.scale}</span>
                      <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold text-slate-300">{portal.status}</span>
                    </div>
                    <button onClick={()=>toggleStar(portal.id)} aria-label={`${isStarred?'Remove':'Add'} ${portal.title} star`} className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/25 text-2xl">{isStarred?'★':'☆'}</button>
                  </div>

                  <div className="mt-auto pt-8">
                    <h2 className={`${portal.scale==='hero'?'text-5xl sm:text-7xl':'text-3xl sm:text-5xl'} font-black tracking-[-.055em]`}>{portal.title}</h2>
                    <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{portal.purpose}</p>
                    {portal.parentPortal && <p className="mt-3 text-sm font-bold text-cyan-300">Extension of {portals.find(p=>p.id===portal.parentPortal)?.title}</p>}
                    <div className="mt-5 flex flex-wrap gap-2">{portal.services.slice(0,isExpanded?portal.services.length:4).map(service=><span key={service} className="rounded-xl bg-white/[.07] px-3 py-2 text-sm text-slate-300">{service}</span>)}</div>
                    {isExpanded && <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:grid-cols-2">
                      <div><p className="text-xs font-black uppercase tracking-widest text-slate-500">Repository decision</p><p className="mt-1 font-bold">{portal.repositoryDecision}</p></div>
                      <div><p className="text-xs font-black uppercase tracking-widest text-slate-500">Provenance</p><p className="mt-1 text-sm text-slate-300">{portal.provenance.join(' · ')}</p></div>
                    </div>}
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button onClick={()=>setExpanded(isExpanded?null:portal.id)} className="min-h-12 rounded-2xl border border-white/20 bg-white/10 px-5 font-black">{isExpanded?'Collapse portal':'Expand portal'}</button>
                      <Link href={portal.route} className="min-h-12 rounded-2xl bg-white px-5 py-3 font-black text-black">Enter</Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[.025] px-4 py-12 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-4xl font-black tracking-tight">Shared foundation</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Encrypted user data','AES-GCM envelopes with private, shared, and public scopes.'],
              ['Reversible versions','Every consequential edit creates a parent-linked snapshot.'],
              ['Star editing','Users star, feature, hide, restore, and annotate without destroying history.'],
              ['Gitpal / Gitpub','Engineer-station jobs inventory, preserve, test, and propose branch changes.'],
              ['Media service','Shared video, TV, image, audio, captions, rights, and watch-history contracts.'],
              ['Design service','Shared themes, components, accessibility, and responsive portal primitives.'],
              ['Game service','Shared sessions, rewards, achievements, intermissions, and participation proofs.'],
              ['Crown registry','Every surviving repository documents purpose, destination, assets, and decision.'],
            ].map(([title,description])=><div key={title} className="rounded-2xl border border-white/10 bg-black/20 p-5"><h3 className="font-black text-cyan-200">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <h2 className="text-4xl font-black tracking-tight">Repository distillation registry</h2>
        <p className="mt-3 max-w-3xl text-slate-400">Archiving is prohibited until unique code and ideas are inventoried and preserved.</p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-white/[.06] text-slate-300"><tr><th className="p-4">Repository</th><th className="p-4">Decision</th><th className="p-4">Surviving purpose</th><th className="p-4">Destination</th><th className="p-4">Preservation</th><th className="p-4">Implementation</th></tr></thead>
            <tbody>{repositoryRegistry.map(record=><tr key={record.repository} className="border-t border-white/10 align-top"><td className="p-4 font-bold">{record.repository}</td><td className="p-4 text-amber-300">{record.decision}</td><td className="p-4 text-slate-300">{record.survivingPurpose}</td><td className="p-4">{record.destinationPortal}</td><td className="p-4">{record.preservationState}</td><td className="p-4">{record.implementationState}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {active?.id==='bitcoin-crusher' && <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-8"><div className="rounded-[28px] border border-amber-300/25 bg-amber-300/[.06] p-6"><h2 className="text-2xl font-black text-amber-200">Bitcoin Crusher participation rule</h2><p className="mt-2 max-w-4xl leading-7 text-amber-50/75">The intermission may display a Git Coin or Infinity participation record only when provider, record ID, verification time, and verifier are present. Unverified participation can remain private draft data but cannot generate public credit or a verified reward display.</p></div></section>}
    </main>
  );
}
