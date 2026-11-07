import Link from 'next/link'
import { ArrowUpRight, FlaskConical, Shield, Clock3, ChevronRight } from 'lucide-react'

export default function Home() {
  return <main className="console-page">
    <div className="console-page-heading"><div><p className="console-eyebrow">PERSONAL COMPANION</p><h1>Your next upgrade starts here.</h1><p className="console-subtitle">A quiet workspace for research timing and Wall survival.</p></div></div>
    <Link href="/damage" className="console-feature group">
      <div><span className="console-kicker"><Shield size={15}/>DEFENSE WORKSPACE</span><h2>Know what your Wall can take.</h2><p>Health, regeneration and active reductions.<br className="hidden sm:block"/>Model Scatter, Ray and Boss encounters in one place.</p><span className="console-cta">Open Wall survival <ArrowUpRight size={16}/></span></div>
      <div className="console-tower-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="tower-core"><CastleMark/></div><span className="art-tag">WALL · REGEN · THORNS</span></div>
    </Link>
    <div className="grid gap-4 sm:grid-cols-2 mt-5">
      {[{href:'/research',icon:FlaskConical,kicker:'RESEARCH',title:'Five labs. One view.',text:'Live countdowns, speed multipliers and completion times.',action:'Open Lab timers'}, {href:'/daily',icon:Clock3,kicker:'QUICK TOOL',title:'Plan around your time.',text:'Add a duration to the current time and see when it ends.',action:'Open Time calculator'}].map(({href,icon:Icon,kicker,title,text,action})=><Link key={href} href={href} className="console-tool-card"><div className="flex justify-between items-center"><span className="console-kicker"><Icon size={16}/>{kicker}</span><ArrowUpRight size={17} className="text-muted-foreground"/></div><h2>{title}</h2><p>{text}</p><span className="inline-flex items-center gap-2 text-xs text-primary mt-7">{action}<ChevronRight size={14}/></span></Link>)}
    </div>
    <p className="console-footer-note">Built for your tower. Settings stay on this device.</p>
  </main>
}
function CastleMark(){return <Shield size={44} strokeWidth={1.1}/>}
