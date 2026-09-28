import MercuryDimeTestSale from "@/components/MercuryDimeTestSale";
import { appPath } from "@/lib/base-path";

export default function BuildPhiSaleCardPage() {
  return <main className="min-h-screen bg-slate-50 pb-20 pt-12 text-slate-950">
    <div className="mx-auto max-w-6xl px-3 sm:px-5">
      <a href={appPath("phi/build")} className="text-sm font-black text-violet-700">← Build Phi</a>
      <h1 className="mt-5 text-3xl font-black">Build Phi · sale card</h1>
      <p className="mt-2 max-w-2xl text-slate-600">A reusable orange product card with a test checkout and local receipt inbox. The live NEC transfer will replace the simulated completion after the wallet and receipt APIs are connected.</p>
    </div>
    <MercuryDimeTestSale />
  </main>;
}
