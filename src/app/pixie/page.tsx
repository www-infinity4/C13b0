'use client';

import { useMemo, useState } from 'react';
import { helperCarts } from '@/carts/registry';

const wedges = ['Write a note','Plan a party','Soap spotlight','Recipe idea','Memory of the day','Photo story','Make a list','Build a page'];

export default function PixiePage(){
  const [rotation,setRotation]=useState(0);
  const [result,setResult]=useState('Tap the spinner for a Pixie idea.');
  const [task,setTask]=useState('');
  const [selected,setSelected]=useState('reader');
  const active=useMemo(()=>helperCarts.find(cart=>cart.id===selected)!,[selected]);

  function spin(){
    const index=Math.floor(Math.random()*wedges.length);
    setRotation(current=>current+1080+index*(360/wedges.length));
    setTimeout(()=>setResult(wedges[index]),650);
  }

  return <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#ffd1e8_0,#f7a9ce_25%,#a66ad8_62%,#391958_100%)] text-[#33112e]">
    <header className="px-4 pb-8 pt-8 sm:px-8">
      <div className="mx-auto max-w-6xl rounded-[32px] border border-white/50 bg-white/72 p-6 shadow-2xl shadow-fuchsia-950/20 backdrop-blur-xl sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.24em] text-fuchsia-700">Pink Edition Reconstruction</p>
        <h1 className="mt-2 text-6xl font-black tracking-[-.06em] text-fuchsia-950 sm:text-8xl">Pixie</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-fuchsia-950/75">A warm personal home page with an idea spinner, writing and reading helpers, party planning, memories, lists, and supervised C13b0 autopilot.</p>
      </div>
    </header>

    <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-8 sm:px-8 lg:grid-cols-[430px_1fr]">
      <article className="rounded-[30px] border border-white/45 bg-white/70 p-6 shadow-xl backdrop-blur">
        <h2 className="text-3xl font-black">Pixie Spinner</h2>
        <p className="mt-2 text-base leading-7 text-fuchsia-950/70">A cheerful task-and-entertainment spinner inspired by Bitcoin Crusher and Mario Spin, without gambling.</p>
        <div className="relative mx-auto mt-6 aspect-square w-full max-w-[340px]">
          <div className="absolute left-1/2 top-[-8px] z-10 -translate-x-1/2 text-4xl">▼</div>
          <button onClick={spin} aria-label="Spin Pixie ideas" className="h-full w-full rounded-full border-[12px] border-white bg-[conic-gradient(#ff5fa2_0_12.5%,#ffc857_12.5%_25%,#8e6cf2_25%_37.5%,#70d6ff_37.5%_50%,#ff9fdb_50%_62.5%,#c8f7c5_62.5%_75%,#ff7f7f_75%_87.5%,#f4e285_87.5%_100%)] shadow-2xl transition-transform duration-700" style={{transform:`rotate(${rotation}deg)`}}><span className="grid h-full place-items-center"><span className="grid h-28 w-28 place-items-center rounded-full border-8 border-white bg-fuchsia-950 text-xl font-black text-white shadow-xl">SPIN</span></span></button>
        </div>
        <div className="mt-5 rounded-2xl bg-fuchsia-950 p-4 text-center text-xl font-black text-white">{result}</div>
      </article>

      <article className="rounded-[30px] border border-white/45 bg-white/70 p-6 shadow-xl backdrop-blur">
        <h2 className="text-3xl font-black">Ask Pixie AI</h2>
        <p className="mt-2 leading-7 text-fuchsia-950/70">Describe what needs done. The helper system routes it through Reader, Logic, Reasoning, Writer, Planner, Builder, Review, and approval.</p>
        <textarea value={task} onChange={event=>setTask(event.target.value)} placeholder="Example: Help me plan a birthday party and write the invitations…" className="mt-5 min-h-36 w-full rounded-2xl border border-fuchsia-300 bg-white p-4 text-lg outline-none focus:border-fuchsia-700" />
        <button className="mt-3 min-h-14 w-full rounded-2xl bg-gradient-to-r from-fuchsia-700 to-violet-600 px-5 text-lg font-black text-white">Prepare a supervised plan</button>
        <div className="mt-5 rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4 text-sm leading-6 text-fuchsia-950/75">Nothing is sent, purchased, published, scheduled, deleted, or overwritten without approval.</div>
      </article>
    </section>

    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-8">
      <h2 className="text-4xl font-black text-white drop-shadow">Pixie’s helper carts</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="grid gap-2">
          {helperCarts.map(cart=><button key={cart.id} onClick={()=>setSelected(cart.id)} className={`min-h-12 rounded-2xl border px-4 text-left font-black ${selected===cart.id?'border-white bg-white text-fuchsia-950':'border-white/35 bg-fuchsia-950/35 text-white'}`}>{cart.title}</button>)}
        </div>
        <article className="rounded-[28px] border border-white/45 bg-white/80 p-6 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-3xl font-black">{active.title}</h3><span className="rounded-full bg-fuchsia-100 px-3 py-1 text-sm font-black text-fuchsia-800">{active.status}</span></div>
          <p className="mt-3 text-lg leading-8 text-fuchsia-950/75">{active.role}</p>
          <h4 className="mt-5 font-black uppercase tracking-widest text-fuchsia-700">Capabilities</h4>
          <div className="mt-2 flex flex-wrap gap-2">{active.capabilities.map(item=><span key={item} className="rounded-xl bg-violet-100 px-3 py-2 font-bold text-violet-900">{item}</span>)}</div>
          {active.requiresApproval.length>0&&<><h4 className="mt-5 font-black uppercase tracking-widest text-rose-700">Approval required</h4><p className="mt-2 leading-7 text-rose-900">{active.requiresApproval.join(' · ')}</p></>}
        </article>
      </div>
    </section>
  </main>;
}
