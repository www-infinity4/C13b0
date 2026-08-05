'use client';

import { useMemo, useState } from 'react';
import {
  CrownRankMode,
  CrownType,
  crownSeeds,
  repositoryInventoryCount,
  repositoryRealmGroups,
  searchCrown,
} from '@/crown-index';

const modes: { id: CrownRankMode; label: string }[] = [
  { id: 'best', label: 'Best Match' },
  { id: 'trusted', label: 'Trusted' },
  { id: 'new', label: 'New' },
  { id: 'original', label: 'Original' },
  { id: 'starquest', label: 'StarQuest' },
  { id: 'network', label: 'Infinity Network' },
];

const filters: { id: CrownType | 'all'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'repository', label: 'Repositories' },
  { id: 'website', label: 'Sites' },
  { id: 'research', label: 'Research' },
  { id: 'tool', label: 'Tools' },
  { id: 'world', label: 'Worlds' },
  { id: 'star-coin', label: 'Star Coins' },
  { id: 'avatar-coin', label: 'Avatar Coins' },
  { id: 'trading-card', label: 'Cards' },
  { id: 'creator', label: 'Creators' },
];

export default function CrownIndexPage() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<CrownRankMode>('best');
  const [type, setType] = useState<CrownType | 'all'>('all');
  const [realm, setRealm] = useState<string | 'all'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [buildOpen, setBuildOpen] = useState(false);

  const results = useMemo(
    () => searchCrown(query, crownSeeds, mode, type, realm),
    [query, mode, type, realm]
  );

  function toggleSelected(id: string) {
    setSelected(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id]);
  }

  return (
    <main className="min-h-screen bg-[#050811] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-4 pb-8 pt-8 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(93,79,255,.25),transparent_34%),radial-gradient(circle_at_82%_0%,rgba(241,194,78,.16),transparent_28%)]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-3 text-xs font-bold uppercase tracking-[.24em] text-violet-300">
            C13b0 · Infinity Discovery Machine
          </div>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-5xl font-black tracking-[-.055em] sm:text-7xl">Crown Index</h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
                The repository-first index for everything built under www-infinity4.
                Search the live project inventory, Infinity machines, research, creators,
                cards, coins, files, and StarQuest identities—then build from an attributed evidence bundle.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-sm backdrop-blur">
              <div>
                <strong className="block text-xl text-amber-300">{repositoryInventoryCount}</strong>
                <span className="text-slate-400">Repositories</span>
              </div>
              <div>
                <strong className="block text-xl text-cyan-300">{repositoryRealmGroups.length}</strong>
                <span className="text-slate-400">Realms</span>
              </div>
              <div>
                <strong className="block text-xl text-emerald-300">{crownSeeds.length}</strong>
                <span className="text-slate-400">Crown records</span>
              </div>
            </div>
          </div>

          <div className="mt-7 rounded-[28px] border border-violet-400/30 bg-black/35 p-3 shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
            <label className="sr-only" htmlFor="crown-search">Search Crown Index</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="crown-search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search a repository, person, world, coin, research topic, or idea to build…"
                className="min-h-14 flex-1 rounded-2xl border border-white/10 bg-[#0b1120] px-5 text-lg outline-none placeholder:text-slate-500 focus:border-violet-400"
              />
              <button className="min-h-14 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-400 px-7 font-black text-black">
                Search Crown
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {modes.map(item => (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                className={`min-h-11 shrink-0 rounded-full border px-4 font-bold ${
                  mode === item.id
                    ? 'border-amber-300 bg-amber-300 text-black'
                    : 'border-white/15 bg-white/5 text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[250px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <h2 className="mb-3 text-sm font-black uppercase tracking-[.18em] text-slate-400">
            Record types
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible">
            {filters.map(item => (
              <button
                key={item.id}
                onClick={() => setType(item.id)}
                className={`min-h-11 shrink-0 rounded-xl border px-4 text-left font-bold ${
                  type === item.id
                    ? 'border-violet-400 bg-violet-500/20 text-white'
                    : 'border-white/10 bg-white/[.035] text-slate-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <h2 className="mb-3 mt-6 text-sm font-black uppercase tracking-[.18em] text-slate-400">
            Portfolio realms
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:max-h-[42vh] lg:overflow-y-auto lg:pr-1">
            <button
              onClick={() => setRealm('all')}
              className={`min-h-11 shrink-0 rounded-xl border px-4 text-left text-sm font-bold ${
                realm === 'all'
                  ? 'border-cyan-300 bg-cyan-300/15 text-white'
                  : 'border-white/10 bg-white/[.035] text-slate-400'
              }`}
            >
              All realms
            </button>
            {repositoryRealmGroups.map(group => (
              <button
                key={group.id}
                onClick={() => setRealm(group.id)}
                className={`min-h-11 shrink-0 rounded-xl border px-4 text-left text-sm font-bold ${
                  realm === group.id
                    ? 'border-cyan-300 bg-cyan-300/15 text-white'
                    : 'border-white/10 bg-white/[.035] text-slate-400'
                }`}
              >
                {group.label}
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {group.repositories.length} repositories
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.035] p-4">
            <div className="text-xs font-black uppercase tracking-[.15em] text-cyan-300">
              Scanner flow
            </div>
            <ol className="mt-3 space-y-2 text-sm text-slate-400">
              <li>1. Repository inventory</li>
              <li>2. Policy gate</li>
              <li>3. Fetch and parse</li>
              <li>4. Canonicalize</li>
              <li>5. Verify sources</li>
              <li>6. Rank transparently</li>
              <li>7. Index files beneath repositories</li>
              <li>8. Build evidence bundle</li>
            </ol>
          </div>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">{results.length} Crown results</h2>
              <p className="text-sm text-slate-400">
                Repositories appear first when no search is entered · Ranking mode:{' '}
                {modes.find(item => item.id === mode)?.label}
              </p>
            </div>
            <button
              disabled={!selected.length}
              onClick={() => setBuildOpen(true)}
              className="min-h-12 rounded-xl bg-amber-300 px-5 font-black text-black disabled:cursor-not-allowed disabled:opacity-35"
            >
              Build from {selected.length || 0} result{selected.length === 1 ? '' : 's'}
            </button>
          </div>

          <div className="space-y-4">
            {results.map(record => {
              const openUrl = record.sources.find(source => source.url)?.url;

              return (
                <article
                  key={record.id}
                  className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[.065] to-white/[.025] p-5 shadow-xl shadow-black/20"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[.12em]">
                        <span className="rounded-full bg-violet-400/15 px-3 py-1 text-violet-200">
                          {record.type}
                        </span>
                        {record.realm && (
                          <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-200">
                            {record.realm}
                          </span>
                        )}
                        {record.priority && (
                          <span className="rounded-full bg-white/10 px-3 py-1 text-slate-300">
                            {record.priority}
                          </span>
                        )}
                        {record.verified && (
                          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-200">
                            Live indexed record
                          </span>
                        )}
                        {record.starQuest && (
                          <span className="rounded-full bg-amber-300/15 px-3 py-1 text-amber-200">
                            StarQuest
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 break-words text-2xl font-black tracking-tight">
                        {record.title}
                      </h3>
                      <p className="mt-2 max-w-3xl text-base leading-7 text-slate-300">
                        {record.summary}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-center">
                      <strong className="block text-2xl text-cyan-200">
                        {Math.round(record.score * 100)}
                      </strong>
                      <span className="text-xs uppercase tracking-widest text-cyan-300">
                        Crown score
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {record.scoreExplanation.map(item => (
                      <span
                        key={item}
                        className="rounded-lg bg-black/25 px-3 py-1.5 text-sm text-slate-400"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-400">
                      Source:{' '}
                      <strong className="text-slate-200">
                        {record.sources.map(source => source.label).join(', ')}
                      </strong>
                      {record.edition && (
                        <>
                          {' '}· Edition:{' '}
                          <strong className="text-slate-200">{record.edition}</strong>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleSelected(record.id)}
                        className={`min-h-11 rounded-xl border px-4 font-bold ${
                          selected.includes(record.id)
                            ? 'border-amber-300 bg-amber-300 text-black'
                            : 'border-white/15 bg-white/5'
                        }`}
                      >
                        {selected.includes(record.id) ? 'Added to build' : 'Add to build'}
                      </button>
                      {openUrl ? (
                        <a
                          href={openUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="grid min-h-11 place-items-center rounded-xl border border-white/15 bg-white/5 px-4 font-bold"
                        >
                          Open record
                        </a>
                      ) : (
                        <button className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 font-bold">
                          Open record
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {buildOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/80 p-3 backdrop-blur sm:place-items-center">
          <section className="w-full max-w-2xl rounded-[28px] border border-amber-300/30 bg-[#0b1120] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[.2em] text-amber-300">
                  Crown Builder
                </div>
                <h2 className="mt-2 text-3xl font-black">Generate from evidence</h2>
              </div>
              <button
                onClick={() => setBuildOpen(false)}
                className="min-h-11 min-w-11 rounded-xl border border-white/15"
              >
                ×
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-slate-300">
              <p className="font-bold text-white">Selected Crown IDs</p>
              <p className="mt-2 break-words text-sm">{selected.join(' · ')}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                'Website',
                'Research page',
                'AI tool',
                'StarQuest world',
                'Star Coin page',
                'Avatar Coin page',
              ].map(option => (
                <button
                  key={option}
                  className="min-h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-left font-black hover:border-violet-400"
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-400">
              The production builder preserves citations, provenance, asset rights,
              contradictions, and security review. Generated output is re-indexed as a new Crown record.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
