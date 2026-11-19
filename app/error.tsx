"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-white"><section className="max-w-lg rounded-3xl border border-pink-500/50 p-8">
    <h1 className="font-pixel text-2xl">PLEASE TRY AGAIN</h1><p className="my-5 text-slate-300">We could not load this page. Please retry to check your latest saved information.</p>
    <button onClick={reset} className="rounded-xl bg-pink-600 px-5 py-3">Retry</button>
  </section></main>;
}
