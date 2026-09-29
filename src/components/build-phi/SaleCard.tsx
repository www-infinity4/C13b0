"use client";

export type SaleCardListing = { id?: string; title: string; priceLabel: string; imageUrl: string; imageAlt: string; description: string; badge?: string; testOnly?: boolean };
type Props = { listing: SaleCardListing; onBuy: () => void; onCollect?: () => void; onShare?: () => void; onShopPhi?: () => void; collected?: boolean };

export default function SaleCard({ listing, onBuy, onCollect, onShare, onShopPhi, collected = false }: Props) {
  return <article className="overflow-hidden rounded-[30px] border-2 border-orange-400 bg-gradient-to-br from-orange-500 via-orange-600 to-red-800 text-white shadow-2xl">
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="grid min-h-64 place-items-center bg-transparent p-6"><img src={listing.imageUrl} alt={listing.imageAlt} className="max-h-72 w-full object-contain drop-shadow-2xl mix-blend-multiply" /></div>
      <div className="flex flex-col justify-center p-6 sm:p-9">
        <div className="flex flex-wrap items-center gap-2"><span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-widest text-orange-950">Advertisement</span><span className="w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest">{listing.badge || "For sale"}</span></div>
        <h2 className="mt-4 text-3xl font-black sm:text-4xl">{listing.title}</h2><p className="mt-3 max-w-xl text-orange-50">{listing.description}</p><strong className="mt-6 text-3xl">{listing.priceLabel}</strong>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onBuy} className="rounded-full border-2 border-white bg-white px-7 py-3 font-black text-orange-600 shadow-lg transition hover:bg-orange-50">Buy It Now</button>
          {onCollect && <button type="button" onClick={onCollect} className="rounded-full bg-white px-6 py-3 font-black text-orange-950 shadow-lg">{collected ? "Collected ✓" : "Collect"}</button>}
          {onShare && <button type="button" onClick={onShare} className="rounded-full border border-white/60 bg-white/10 px-6 py-3 font-black text-white">Share · +0.1 StarCoin</button>}
          {onShopPhi && <button type="button" onClick={onShopPhi} className="rounded-full border border-white/60 bg-white/10 px-6 py-3 font-black text-white">Shop Phi · similar items</button>}
        </div>
        {listing.testOnly && <p className="mt-4 text-xs text-orange-100">Checkout demonstration only. No wallet debit or physical shipment.</p>}
      </div>
    </div>
  </article>;
}
