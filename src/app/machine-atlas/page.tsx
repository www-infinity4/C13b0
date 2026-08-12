'use client';

import { useMemo, useState } from 'react';
import { machineRegistry, MachineCategory, MachineLayer } from '@/machine-os/registry';

const categories: Array<MachineCategory | 'all'> = ['all','core','terminal','portal','storage','brain','vector','visualizer','agent','archive','nursery'];
const layers: Array<MachineLayer | 'all'> = ['all','base','octave2','archive','nursery','experimental'];

export default function MachineAtlasPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MachineCategory | 'all'>('all');
  const [layer, setLayer] = useState<MachineLayer | 'all'>('all');
  const [selected, setSelected] = useState<string | null>('mongoose.os');

  const records = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machineRegistry.filter(machine => {
      const matchesQuery = !q || [machine.machineId,machine.title,machine.role,...machine.capabilities]
        .join(' ').toLowerCase().includes(q);
      return matchesQuery && (category === 'all' || machine.category === category) && (layer === 'all' || machine.octave === layer);
    });
  }, [query, category, layer]);

  const active = machineRegistry.find(machine => machine.machineId === selected) || records[0];

  return (
    <main className="min-h-screen bg-[#050812] text-white">
      <header className="border-b border-white/10 bg-[radial-gradient(circle_at_15%_0%,rgba(82,104,255,.26),transparent_35%),radial-gradient(circle_at_90%_5%,rgba(56,220,255,.17),transparent_30%)] px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">C13b0 · Crown Index Recovery Layer</p>
          <h1 className="mt-2 text-5xl font-black tracking-[-.055em] sm:text-7xl">Machine Atlas</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">A readable registry for Mongoose.OS, the A–Z chain, Octave layers, Osprey, agents, brain nodes, vector systems, and the visualizers intended to operate as one personal AI network.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[['Machines',machineRegistry.length],['A–Z',26],['Recovered roles',machineRegistry.filter(m=>m.confidence>.7).length],['Pending review',machineRegistry.filter(m=>m.status==='recovery-pending').length]].map(([label,value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur"><strong className="block text-2xl text-amber-300">{value}</strong><span className="text-sm text-slate-400">{label}</span></div>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-8">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search machines, roles, carts, portals, vectors, visualizers…" className="min-h-14 rounded-2xl border border-white/10 bg-[#0b1120] px-5 text-lg outline-none focus:border-cyan-300" />
          <select value={category} onChange={e=>setCategory(e.target.value as MachineCategory|'all')} className="min-h-14 rounded-2xl border border-white/10 bg-[#0b1120] px-4 text-base"><option disabled>Category</option>{categories.map(item=><option key={item}>{item}</option>)}</select>
          <select value={layer} onChange={e=>setLayer(e.target.value as MachineLayer|'all')} className="min-h-14 rounded-2xl border border-white/10 bg-[#0b1120] px-4 text-base"><option disabled>Octave layer</option>{layers.map(item=><option key={item}>{item}</option>)}</select>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-10 sm:px-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl font-black">{records.length} visible machines</h2><a href="/crown-index" className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-2 font-bold text-violet-200">Open Crown Index</a></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {records.map(machine => (
              <button key={machine.machineId} onClick={()=>setSelected(machine.machineId)} className={`min-h-48 rounded-[22px] border p-5 text-left transition ${selected===machine.machineId?'border-cyan-300 bg-cyan-300/10':'border-white/10 bg-white/[.035] hover:border-white/30'}`}>
                <div className="flex items-start justify-between gap-3"><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-300">{machine.category}</span><span className={`text-xs font-bold ${machine.status==='recovery-pending'?'text-amber-300':'text-emerald-300'}`}>{machine.status}</span></div>
                <h3 className="mt-4 text-2xl font-black tracking-tight">{machine.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{machine.role}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{machine.machineId}</span><span>{Math.round(machine.confidence*100)}% recovered</span></div>
              </button>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          {active && <div className="rounded-[26px] border border-white/10 bg-gradient-to-br from-white/[.07] to-white/[.025] p-6 shadow-2xl shadow-black/30">
            <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Selected machine</p>
            <h2 className="mt-2 text-3xl font-black">{active.title}</h2>
            <p className="mt-3 leading-7 text-slate-300">{active.role}</p>
            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="text-slate-500">Machine ID</dt><dd className="font-bold">{active.machineId}</dd></div>
              <div><dt className="text-slate-500">Category</dt><dd className="font-bold">{active.category}</dd></div>
              <div><dt className="text-slate-500">Octave</dt><dd className="font-bold">{active.octave}</dd></div>
              <div><dt className="text-slate-500">Status</dt><dd className="font-bold">{active.status}</dd></div>
            </dl>
            <div className="mt-5"><h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Capabilities</h3><div className="mt-2 flex flex-wrap gap-2">{active.capabilities.length?active.capabilities.map(item=><span key={item} className="rounded-lg bg-black/30 px-3 py-1.5 text-sm text-slate-300">{item}</span>):<span className="text-sm text-amber-300">Repository inspection required</span>}</div></div>
            <div className="mt-5"><h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Mounts</h3><p className="mt-2 text-sm leading-6 text-slate-300">{active.mounts.join(' · ') || 'None recovered yet'}</p></div>
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">Unknown alphabet roles are intentionally marked recovery pending. The atlas does not invent responsibilities merely to fill the A–Z sequence.</div>
          </div>}
        </aside>
      </section>

      <section className="border-t border-white/10 bg-black/20 px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-black">Recovered operating path</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {['i · Input','mongoose.os · Orchestrate','k · Quantum / Vector Portal','j · Output / Octave UI','z · Optional storage'].map((item,index)=><div key={item} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><span className="text-xs font-black text-cyan-300">0{index+1}</span><strong className="mt-2 block">{item}</strong></div>)}
          </div>
          <p className="mt-5 max-w-4xl text-slate-400">Storage is mounted only when needed. The later `j` path-repair conversation explicitly rejected introducing `z` into that specific workflow, so the atlas keeps storage as a capability rather than a forced dependency.</p>
        </div>
      </section>
    </main>
  );
}
