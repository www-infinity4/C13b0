"use client";

import { FormEvent, useEffect, useState } from "react";
import SaleCard from "@/components/build-phi/SaleCard";
import { addPhiCartItem, readPhiCart, PHI_CART_KEY } from "@/components/build-phi/PhiShopCart";

const KEY = "infinityPhi:testReceipts:v1";
const PHOTO = "https://commons.wikimedia.org/wiki/Special:FilePath/Mercury_dime.jpg";
const LISTING_ID = "test-random-mercury-dime";
const LEGACY_LISTING_ID = "test-1936-d-mercury-dime";
type Receipt = { id: string; placed: string; shipDate: string; destination: string; name: string };
function load(): Receipt[] {
  try { const data = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(data) ? data.slice(0, 20) : []; }
  catch { return []; }
}
export default function MercuryDimeTestSale() {
  const [view, setView] = useState<"listing" | "checkout" | "purchased">("listing");
  const [inbox, setInbox] = useState(false);
  const [collected, setCollected] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [latest, setLatest] = useState<Receipt | null>(null);
  useEffect(() => {
    setReceipts(load());
    try {
      const cart = JSON.parse(localStorage.getItem(PHI_CART_KEY) || "[]");
      if (!Array.isArray(cart)) return;
      const existing = cart.find((x: { id?: string }) => x.id === LISTING_ID || x.id === LEGACY_LISTING_ID);
      if (existing) {
        setCollected(true);
        if (existing.id === LEGACY_LISTING_ID) {
          const migrated = [{ ...existing, id: LISTING_ID, title: "Mercury dime" }, ...cart.filter((x: { id?: string }) => x.id !== LEGACY_LISTING_ID && x.id !== LISTING_ID)];
          localStorage.setItem(PHI_CART_KEY, JSON.stringify(migrated));
          window.dispatchEvent(new CustomEvent("infinity-shop-cart-updated", { detail: { item: migrated[0], count: migrated.length } }));
        }
      }
    } catch {}
    const syncCollected = () => {
      const cart = readPhiCart();
      setCollected(cart.some(x => x.id === LISTING_ID || x.id === LEGACY_LISTING_ID));
    };
    window.addEventListener("infinity-shop-cart-updated", syncCollected);
    window.addEventListener("storage", syncCollected);
    return () => {
      window.removeEventListener("infinity-shop-cart-updated", syncCollected);
      window.removeEventListener("storage", syncCollected);
    };
  }, []);
  function collect() {
    const next = addPhiCartItem({ id: LISTING_ID, title: "Mercury dime", priceLabel: "100 Quants", imageUrl: PHOTO, description: "One Mercury dime. Representative stock photo; test listing." });
    const saved = next.some(item => item.id === LISTING_ID);
    setCollected(saved);
    if (!saved) return;
    const control = (window as Window & { ControlPhi?: { ensureActionCredit?: (reference:string,kind:string)=>unknown } }).ControlPhi;
    control?.ensureActionCredit?.(LISTING_ID, "collect");
    window.dispatchEvent(new CustomEvent("infinity-starcoin-collect", { detail: { source: "advertisement", listingId: LISTING_ID, amount: 0.1 } }));
    window.dispatchEvent(new CustomEvent("infinity-shop-cart-open"));
  }
  async function share() { const url = `${location.origin}${location.pathname}#${LISTING_ID}`; const data = { title: "Mercury dime · Advertisement", text: "Mercury dime · 100 Quants · Infinity Phi test advertisement", url }; try { if (navigator.share) await navigator.share(data); else await navigator.clipboard.writeText(`${data.text} ${url}`); } catch { return; } window.dispatchEvent(new CustomEvent("infinity-starcoin-share", { detail: { source: "advertisement", listingId: LISTING_ID, amount: 0.1, url } })); }
  function shopPhi() { const params = new URLSearchParams({ q: "Mercury dime", source: "infinity-phi-ad" }); window.location.assign(`https://www-infinity4.github.io/Alien-Radio/shop.html?${params.toString()}`); }
  function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const city = String(form.get("city") || "").trim();
    const region = String(form.get("region") || "").trim();
    if (!name || !city || !region) return;
    const placed = new Date(), target = new Date(placed);
    target.setDate(target.getDate() + 3);
    const receipt = {
      id: `TEST-${placed.getTime().toString(36).toUpperCase()}`,
      placed: placed.toISOString(),
      shipDate: target.toISOString().slice(0, 10),
      destination: `${city}, ${region}`,
      name,
    };
    const next = [receipt, ...receipts].slice(0, 20);
    setReceipts(next);
    setLatest(receipt);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    event.currentTarget.reset();
    setView("purchased");
    setInbox(true);
  }
  return <section id={LISTING_ID} aria-label="Mercury dime test sale" className="mx-auto w-full max-w-6xl px-3 sm:px-5" style={{margin:"24px auto 30px"}}>
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="text-xs font-black uppercase tracking-[.18em] text-orange-700">Infinity Phi marketplace · test listing</span>
      <button type="button" onClick={() => setInbox(!inbox)} className="rounded-full border border-orange-300 bg-white px-4 py-2 text-sm font-black text-orange-950 shadow-sm" aria-expanded={inbox}>✉ Receipts {receipts.length ? `(${receipts.length})` : ""}</button>
    </div>
    {inbox && <aside className="mb-4 rounded-3xl border border-orange-200 bg-white p-5 shadow-lg" aria-label="Receipt inbox">
      <div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-950">Your message box</h2><button type="button" onClick={() => setInbox(false)} aria-label="Close receipts" className="text-2xl text-slate-600">×</button></div>
      {receipts.length ? <div className="mt-3 space-y-3">{receipts.map(r => <article key={r.id} className="rounded-2xl bg-orange-50 p-4 text-sm text-slate-900">
        <b>Test receipt · Mercury dime</b><p>Receipt {r.id} · 100 Quants · test purchase</p>
        <p>Placed: {new Date(r.placed).toLocaleString()} · Illustrative ship date: {r.shipDate}</p>
        <p>Demo seller: Infinity Phi marketplace test · Contact: no seller contact available · Destination: {r.destination}</p>
        <p className="mt-2 font-bold text-orange-900">No Quants transferred. No item will ship.</p>
      </article>)}</div> : <p className="mt-3 text-sm text-slate-600">Test receipts will appear here after checkout on this browser.</p>}
    </aside>}
    <div className={view === "listing" ? "" : "overflow-hidden rounded-[30px] border-2 border-orange-400 bg-gradient-to-br from-orange-500 via-orange-600 to-red-800 text-white shadow-2xl"}>
      {view === "listing" && <SaleCard listing={{
        title: "Mercury dime",
        priceLabel: "100 Quants",
        imageUrl: PHOTO,
        imageAlt: "Representative stock photo of a Mercury dime, front and back",
        description: "One Mercury dime. Representative stock photo; condition and inventory are not verified for this test listing.",
        badge: "Test sale · coin",
        testOnly: true,
      }} onBuy={() => setView("checkout")} onCollect={collect} collected={collected} onShare={share} onShopPhi={shopPhi} />}
      {view === "checkout" && <div className="mx-auto max-w-2xl p-6 sm:p-9">
        <button type="button" onClick={() => setView("listing")} className="text-sm font-bold text-orange-100">← Back to listing</button>
        <h2 className="mt-4 text-3xl font-black">Shipping information</h2>
        <p className="mt-2 text-orange-50">Mercury dime · 100 Quants · test checkout</p>
        <form onSubmit={complete} className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold sm:col-span-2">Full name<input name="name" required maxLength={100} autoComplete="name" className="mt-1 w-full rounded-xl border border-orange-200 bg-white p-3 text-slate-950" /></label>
          <label className="text-sm font-bold sm:col-span-2">Street address<input name="street" required maxLength={160} autoComplete="street-address" className="mt-1 w-full rounded-xl border border-orange-200 bg-white p-3 text-slate-950" /></label>
          <label className="text-sm font-bold">City<input name="city" required maxLength={80} autoComplete="address-level2" className="mt-1 w-full rounded-xl border border-orange-200 bg-white p-3 text-slate-950" /></label>
          <label className="text-sm font-bold">State / region<input name="region" required maxLength={80} autoComplete="address-level1" className="mt-1 w-full rounded-xl border border-orange-200 bg-white p-3 text-slate-950" /></label>
          <label className="text-sm font-bold">Postal code<input name="postal" required maxLength={24} autoComplete="postal-code" className="mt-1 w-full rounded-xl border border-orange-200 bg-white p-3 text-slate-950" /></label>
          <label className="text-sm font-bold">Country<input name="country" required maxLength={80} autoComplete="country-name" className="mt-1 w-full rounded-xl border border-orange-200 bg-white p-3 text-slate-950" /></label>
          <p className="text-xs text-orange-100 sm:col-span-2">This is a simulated checkout. Address details stay in this form and are discarded when you complete it. The receipt keeps only the city and region.</p>
          <button type="submit" className="mt-2 rounded-full bg-white px-6 py-3 font-black text-orange-950 shadow-lg sm:col-span-2">Complete test sale</button>
        </form>
      </div>}
      {view === "purchased" && <div className="p-8 text-center sm:p-12" role="status">
        <span className="text-5xl">✓</span><h2 className="mt-3 text-3xl font-black">Test purchased</h2>
        <p className="mt-3">Receipt {latest?.id} is in your message box.</p>
        <p className="mt-2 text-sm text-orange-100">No Quants transferred. No physical coin will ship.</p>
        <button type="button" onClick={() => setView("listing")} className="mt-6 rounded-full bg-white px-6 py-3 font-black text-orange-950">View listing</button>
      </div>}
    </div>
    <p className="mt-2 text-xs text-slate-500">Stock image: <a href="https://commons.wikimedia.org/wiki/File:Mercury_dime.jpg" target="_blank" rel="noopener noreferrer" className="underline">Wikimedia Commons</a>. Test listing image, not an image of an item held by a seller.</p>
  </section>;
}
