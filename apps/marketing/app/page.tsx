import Link from "next/link";
import { formatPrice, PLAN_ORDER, PLANS } from "@qubo-portal/plans";
import { portalUrl } from "@/lib/site";


const FEATURES = [
  { title: "Visual editor", body: "Compose pages from blocks, preview on every device, publish instantly. Content lives in your database, not in templates." },
  { title: "Many sites, one panel", body: "Run several brands and domains from one install. Switch sites without switching tools." },
  { title: "Commerce built in", body: "Catalogue, variants, orders, customers and checkout when a site needs to sell, invisible when it doesn't." },
  { title: "Inbox", body: "Forms, chat and e-mail land in one place, per site, with AI triage on your own key." },
  { title: "Self-hosted", body: "Your server, your database, your data. Export is a database dump. No transaction fees, ever." },
  { title: "Fast by default", body: "Server-rendered pages with sitemaps, structured data and Open Graph for every site, out of the box." },
];

export default function Home() {
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">qubo</span>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#features" className="text-neutral-600 hover:text-ink">Features</a>
          <a href="#pricing" className="text-neutral-600 hover:text-ink">Pricing</a>
          <Link href={`${portalUrl()}/login`} className="rounded-md bg-ink px-3 py-1.5 font-medium text-white">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-20 pb-24 text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-6xl">Every site you run, from one panel on your own server.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600 text-pretty">
            Qubo is a self-hosted site builder and back office. Build pages visually, run a shop when you need one, and keep every byte on infrastructure you own.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link href={`${portalUrl()}/login?mode=signup`} className="rounded-md bg-accent px-5 py-3 font-medium text-white">Start free</Link>
            <a href="#pricing" className="rounded-md border border-neutral-300 px-5 py-3 font-medium">See pricing</a>
          </div>
        </section>

        <section id="features" className="border-t border-neutral-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-px px-6 py-20 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6">
                <h2 className="font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm text-neutral-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Pricing per organisation</h2>
          <p className="mt-3 text-center text-neutral-600">Collaborators are always free. 0% transaction fees on every plan.</p>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PLAN_ORDER.map((id) => {
              const p = PLANS[id];
              return (
                <div key={id} className={`flex flex-col rounded-xl border bg-white p-6 ${id === "growth" ? "border-accent" : "border-neutral-200"}`}>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{p.tagline}</p>
                  <p className="mt-6 text-3xl font-semibold">
                    {formatPrice(p)}
                    {p.per && <span className="text-sm font-normal text-neutral-500"> /{p.per === "org" ? "org" : "account"}/mo</span>}
                  </p>
                  <ul className="mt-6 flex flex-1 flex-col gap-2 text-sm">
                    {p.highlights.map((h) => <li key={h}>✓ {h}</li>)}
                  </ul>
                  <Link href={`${portalUrl()}/login?mode=signup`} className="mt-8 rounded-md border border-neutral-300 px-3 py-2 text-center text-sm font-medium">
                    {p.priceCents ? `Choose ${p.name}` : "Start free"}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 py-10 text-center text-sm text-neutral-500">
        Qubo · built by <a className="underline" href="https://by-ali.dev">Ali</a>
      </footer>
    </>
  );
}
