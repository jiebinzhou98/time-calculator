'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Castle, LayoutDashboard, FlaskConical, Shield, Clock3, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href:'/', label:'Overview', icon:LayoutDashboard },
  { href:'/research', label:'Lab timers', icon:FlaskConical },
  { href:'/damage', label:'Wall survival', icon:Shield },
  { href:'/daily', label:'Time calculator', icon:Clock3 },
]
export function AppNav() {
  const pathname=usePathname()
  return <>
    <aside className="console-sidebar">
      <Link href="/" className="console-brand"><Castle size={22} strokeWidth={1.6}/><span>Tower<span className="font-normal text-muted-foreground"> Tools</span></span></Link>
      <p className="console-nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation" className="space-y-1">
        {links.map(({href,label,icon:Icon})=><Link key={href} href={href} aria-current={pathname===href?'page':undefined} className={cn('console-nav-link',pathname===href&&'active')}><Icon size={17} strokeWidth={1.7}/>{label}</Link>)}
      </nav>
      <div className="console-sidebar-footer"><span className="console-dot"/>Local data saved on this device<p>The Tower · Personal companion</p></div>
    </aside>
    <header className="console-topbar">
      <Link href="/" className="console-brand md:hidden"><Castle size={21}/><span>Tower Tools</span></Link>
      <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground"><span>Workspace</span><span className="opacity-40">/</span><span className="text-foreground">{links.find(l=>l.href===pathname)?.label??'Overview'}</span></div>
      <span className="console-top-note"><span className="console-dot"/>Personal workspace<ArrowUpRight size={13}/></span>
    </header>
    <nav className="console-bottom-nav" aria-label="Mobile navigation">
      {links.map(({href,label,icon:Icon})=><Link key={href} href={href} aria-current={pathname===href?'page':undefined} className={cn(pathname===href&&'active')}><Icon size={19} strokeWidth={1.7}/><span>{label==='Time calculator'?'Time':label==='Wall survival'?'Wall':label==='Lab timers'?'Labs':'Overview'}</span></Link>)}
    </nav>
  </>
}
