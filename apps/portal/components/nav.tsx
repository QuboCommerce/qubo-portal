"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Overview" },
  { href: "/instances", label: "Instances" },
  { href: "/billing", label: "Plan & billing" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {items.map((i) => {
        const on = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`rounded-md px-3 py-1.5 ${on ? "bg-white font-medium text-ink shadow-sm ring-1 ring-neutral-200" : "text-neutral-600 hover:text-ink"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
