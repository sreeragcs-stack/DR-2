import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// A PUBLIC page — no auth required, anyone can see it. This is the pattern for authless pages:
// just render it; don't gate it behind a login check. Replace with your real landing page.
export default function HomePage() {
  return (
    <>
    {/* just render it; don't gate it behind a login check. Replace with your real landing page. */}
    <div className="absolute inset-0">
    <div className="absolute inset-0"></div>

    <div className="absolute inset-0 bg-[linear-gradient(#ce8404be_1px,transparent_1px),linear-gradient(90deg,#ce8404be_1px,transparent_1px)] bg-[size:50px_50px] opacity-15"></div>
    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-transparent"></div>
    </div>
    <main className="relative flex min-h-screen items-center justify-center px-6">
    <div className="w-full max-w-2xl text-center">
        <h1 className="mt-8 text-4xl font-bold tracking-tight text-[#171717]">
        Almost
        <span className="text-[#ce8404]"> Ready.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-6 text-[#171717]/50">We're putting the finishing touches on our new experience. Please wait a moment while everything loads.</p>
        <div className="mt-14 flex justify-center">
        <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border border-[#ce8404]/50"></div>
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#ce8404b6]"></div>
        </div>
        </div>
        <div className="mx-auto mt-14 max-w-lg">
        <div className="mb-3 flex justify-between text-sm text-[#171717]/50">
            <span>Loading</span>
            <span>Please wait...</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#ebebeb]">
            <div className="h-full w-4/5 animate-pulse rounded-full bg-gradient-to-r from-[#ce84048c] via-[#ce8404] to-[#ebebebbd]"></div>
        </div>
        </div>
    </div>
    </main>
    </>
  );
}
