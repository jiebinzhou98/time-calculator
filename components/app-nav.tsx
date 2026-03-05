'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const links = [
  {href: "/", label: "Home"},
  {href: "/daily", label: "Daily"},
  {href: "/research", label: "Research"},
];

function TopNav() {
  const pathname = usePathname();

  return(
    <div className="sticky top-0 z-50 hidden border-b bg-background/80 backdrop-blur md:block">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="font-semibold tracking-tight">
          TimeCalc
        </Link>

        <nav className="flex items-center gap-2">
          {links.map((l) => {
            const active = pathname === l.href;
            return(
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
            )
          })}
        </nav>
      </div>
    </div>
  );
}

function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 px-3 py-2">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl px-2 py-2 text-xs transition", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="font-medium">{l.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  );
}

export function AppNav() {
  return (
    <>
      <TopNav/>
      <BottomNav/>
    </>
  )
}