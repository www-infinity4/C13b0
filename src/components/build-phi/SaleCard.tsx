"use client";

export type SaleCardListing = {
  title: string;
  priceLabel: string;
  imageUrl: string;
  imageAlt: string;
  description: string;
  badge?: string;
  testOnly?: boolean;
};

export default function SaleCard({ listing, onBuy }: { listing: SaleCardListing; onBuy: () => void }) {
  return <article className="overflow-hidden rounded-[30px] border-2 border-orange-400 bg-gradient-to-br from-orange-500 via-orange-600 to-red-800 text-white shadow-2xl">
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="grid min-h-64 place-items-center bg-orange-100 p-6">
        <img src={listing.imageUrl} alt={listing.imageAlt} className="max-h-72 w-full object-contain drop-shadow-2xl" />
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-9">
        <span className="w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest">{listing.badge || "For sale"}</span>
        <h2 className="mt-4 text-3xl font-black sm:text-4xl">{listing.title}</h2>
        <p className="mt-3 max-w-xl text-orange-50">{listing.description}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <strong className="text-3xl">{listing.priceLabel}</strong>
          <button type="button" onClick={onBuy} className="rounded-full bg-white px-7 py-3 font-black text-orange-950 shadow-lg">Buy now →</button>
        </div>
        {listing.testOnly && <p className="mt-4 text-xs text-orange-100">Checkout demonstration only. No wallet debit or physical shipment.</p>}
      </div>
    </div>
  </article>;
}
