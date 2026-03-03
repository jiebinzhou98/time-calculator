'use client'

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Label } from "radix-ui"

const links = [
  {href: "/", label: "Home"},
  {href: "/daily", label: "Daily"},
  {href: "/research", label: "Research"},
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="font-semibold tracking-tight">
          TimeCalc
        </Link>

        <nav className="flex items-center gap-2">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-3 py-1 text-sm transition",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  )
}