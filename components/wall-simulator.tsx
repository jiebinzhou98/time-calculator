"use client"

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { amount, formatAmount, UNITS, type Unit, type DamageSettings } from '@/lib/damage'
import { buildWallScenario, DEFAULT_WALL, runWall, wallDamageLimit, type WallSettings } from '@/lib/wall'

const STORAGE = 'time-calculator-wall-v1'
const selectClass = 'h-11 w-full rounded-md border border-input bg-background px-3 text-sm'

function Quantity({label,value,unit,onChange}:{label:string;value:string;unit:Unit;onChange:(v:string,u:Unit)=>void}) {
  return <label className="block space-y-2"><span className="text-sm font-medium">{label}</span><span className="flex gap-2"><Input className="h-11" aria-label={label} type="number" min="0" step="any" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value,unit)} placeholder="Enter in-game value"/><select className={`${selectClass} max-w-24`} aria-label={`${label} unit`} value={unit} onChange={e=>onChange(value,e.target.value as Unit)}>{Object.keys(UNITS).map(u=><option key={u} value={u}>{u||'No unit'}</option>)}</select></span></label>
}

export function WallSimulator({damage,reductions,onEnemyChange}:{damage:DamageSettings;reductions:ReactNode;onEnemyChange:(enemy:string,unit:Unit)=>void}) {
  const [s,setS]=useState<WallSettings>(DEFAULT_WALL)
  const [loaded,setLoaded]=useState(false)
  useEffect(()=>{
    const id=window.setTimeout(()=>{
      try {
        const data=JSON.parse(localStorage.getItem(STORAGE)??'null')
        if(data && typeof data==='object') {
          const next={...DEFAULT_WALL}
          for(const key of Object.keys(DEFAULT_WALL) as (keyof WallSettings)[]) {
            if(typeof data[key]===typeof DEFAULT_WALL[key]) Object.assign(next,{[key]:data[key]})
          }
          if(!(next.healthUnit in UNITS)) next.healthUnit='q'
          if(!(next.regenUnit in UNITS)) next.regenUnit='T'
          if(!['normal','boss','elite'].includes(next.enemyType)) next.enemyType='normal'
          if(!['wall','tower'].includes(next.regenMode)) next.regenMode='tower'
          setS(next)
        }
      } catch { /* Use defaults when storage is unavailable. */ }
      setLoaded(true)
    },0)
    return ()=>window.clearTimeout(id)
  },[])
  useEffect(()=>{if(loaded){try{localStorage.setItem(STORAGE,JSON.stringify(s))}catch{/* Optional storage. */}}},[s,loaded])
  const patch=(p:Partial<WallSettings>)=>setS(prev=>({...prev,...p}))
  const built=useMemo(()=>buildWallScenario(s,damage),[s,damage])
  const scenario=built.scenario
  const limit=useMemo(()=>scenario?wallDamageLimit(scenario):null,[scenario])
  const enemy=amount(damage.enemy,damage.enemyUnit)
  const run=useMemo(()=>scenario&&enemy!==null?runWall(scenario,enemy,true):null,[scenario,enemy])
  const stress=useMemo(()=>{
    if(!damage.flameOn&&!damage.pcolOn) return null
    const result=buildWallScenario(s,{...damage,flameOn:false,pcolOn:false})
    return result.scenario?wallDamageLimit(result.scenario):null
  },[s,damage])
  const largestBurstWeight = scenario?.hits.reduce((largest,event)=>Math.max(largest,event.weight),0) ?? 0
  const averageWeight = scenario ? scenario.hits.reduce((total,event)=>total+event.weight,0)/scenario.horizon : 0
  const f=(n:number|null|undefined)=>n==null?'—':formatAmount(n)
  function field(label:string,key:keyof WallSettings,min:number,max:number,step:number|string='any') {
    return <label className="block space-y-2 text-sm"><span className="font-medium">{label}</span><Input className="h-11" aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step} value={String(s[key])} onChange={e=>patch({[key]:e.target.value})}/></label>
  }
  function toggle(label:string,key:'repeat'|'protected'|'heat'|'bhOn'|'orbOn'|'threatsMode') {
    return <label className="flex items-center gap-3 text-sm font-medium"><input className="size-5 accent-primary" type="checkbox" checked={s[key]} onChange={e=>patch({[key]:e.target.checked})}/>{label}</label>
  }
  const points=run&&scenario?run.trace.map(p=>`${40+p.time/scenario.horizon*520},${180-Math.max(0,p.health)/scenario.health*150}`).join(' '):''
  return <div className="space-y-5">
    <div className="rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed">Wall-only simulation. The default mode models Scatter families, Ray shots and Boss contact, with no ordinary-enemy swarm. Checked reductions assume full coverage on these enemies. BH damage and ordinary Orb kills do not clear them. Timings below are editable scenario inputs, not measured T16 spawn rates.</div>
    <div className="grid gap-6 md:grid-cols-2 items-start">
      <div className="space-y-5">
        <Card><CardHeader><CardTitle>Wall health & regeneration</CardTitle></CardHeader><CardContent className="space-y-4">
          <Quantity label="Fortified Wall maximum health" value={s.health} unit={s.healthUnit} onChange={(health,healthUnit)=>patch({health,healthUnit})}/>
          <p className="text-xs text-muted-foreground">Use the final in-run Wall cap including Fortification 35, modules and perks. Do not multiply Fortification again. Units are case-sensitive: q = 10¹⁵; Q = 10¹⁸.</p>
          {field('Starting Wall health %','startPercent',0.01,100)}
          <label className="block space-y-2 text-sm"><span>Regen value source</span><select className={selectClass} value={s.regenMode} onChange={e=>patch({regenMode:e.target.value as WallSettings['regenMode']})}><option value="tower">Tower Health Regen × Wall Regen %</option><option value="wall">Final Wall Regen (already includes bonuses)</option></select></label>
          <Quantity label={s.regenMode==='tower'?'Tower Health Regen / game second':'Final Wall Regen / game second'} value={s.regen} unit={s.regenUnit} onChange={(regen,regenUnit)=>patch({regen,regenUnit})}/>
          {s.regenMode==='tower'&&field('Wall Regen % (lab 20 = 200%)','wallRegen',0,1000)}
          <p className="text-xs text-muted-foreground">Tower Regen lab 50 alone does not determine this value. Enter the actual in-run stat after perks. If a module changes Wall Regen separately, use final Wall Regen mode.</p>
          <p className="text-sm rounded-lg border p-3">Wall Regen heals continuously at the effective rate while the Wall stands, including between enemy hits. Taking damage does not pause or restart healing. Healing stops at the fortified health cap.</p>
        </CardContent></Card>
        {reductions}
        <Card><CardHeader><CardTitle>Thorns & attacking threats</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">{field('Tower Thorns %','thorns',0,1000)}{field('Wall Thorns % (lab level)','wallThorns',0,100)}</div>
          <p className="text-xs text-muted-foreground">Prefilled for your 110% Tower Thorns and Wall Thorns lab 13. Base retaliation: 110% × 13% = 14.3% of ordinary enemy maximum health per hit. Tower Thorns is not added as a second attack while the Wall stands.</p>
          {toggle('Model Scatter, Ray and Boss only','threatsMode')}
          {s.threatsMode ? <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Starts with one encounter of each threat, no repeated arrivals. Count 0 disables a type; repeat 0 adds no new encounters. Contact attack intervals of 1s are editable estimates. Adjust them to what actually reaches your Wall.</p>
            {field('Simulation duration (game s)','horizon',1,300)}
            {(['scatter','ray','boss'] as const).map(kind=><fieldset key={kind} className="rounded-xl border p-3 space-y-3">
              <legend className="px-2 font-semibold">{kind === 'scatter' ? 'Scatter + children' : kind === 'ray' ? 'Ray' : 'Boss'}</legend>
              <div className="grid grid-cols-2 gap-3">
                {field(`${kind} count per encounter`,`${kind}Count`,0,8,1)}
                {field(`${kind} first attack at (game s)`,`${kind}First`,0,300)}
                {field(`${kind} attack interval (game s)`,`${kind}Interval`,0.25,300)}
                {field(`${kind} new encounter every (0 = none)`,`${kind}Arrival`,0,300)}
              </div>
              {field(`${kind} damage multiplier vs input`,`${kind}Multiplier`,0.001,1000)}
              <p className="text-xs text-muted-foreground">{kind==='scatter'?'Four binary splits produce 1 + 2 + 4 + 8 + 16 bodies. Each generation takes Thorns relative to its own maximum HP. Child damage is not automatically halved. New children first attack one configured interval after the split, with heat-up reset. Checked Flame Bot coverage is assumed to tag every child before its first hit.':kind==='ray'?'Ray baseline: 30-game-second charge and ×2 basic damage. First shot and repeat interval are adjustable for an already-charged Ray / control effects. Wall Thorns retaliates on each shot; it does not fire every second.':'Wall Thorns is half effective on Bosses. The damage multiplier is adjustable: enter the ratio for your actual Boss stat rather than inferring it from its health multiplier.'}</p>
            </fieldset>)}
            {field('Scatter binary split count','scatterSplits',0,4,1)}
            {field('Initial enemy health on arrival %','enemyRemaining',0.01,100)}
            {toggle('Enemy protected: reduced Thorns','protected')}
            {s.protected&&field('Protection damage reduction %','protection',0,99)}
            {toggle('Repeated-hit heat-up (×1.04 per prior hit)','heat')}
            <p className="text-xs text-muted-foreground">The shared enemy damage is the baseline. Each type multiplies it before applying the selected reductions. If you enter an already doubled Ray attack value, set its multiplier to 1. Enemy labs / battle conditions must be reflected in the multipliers. No Plasma Cannon, Orb Boss Hit, direct DPS or Fleet attacks are included.</p>
          </div> : <>
          <label className="block space-y-2 text-sm"><span>Enemy group</span><select aria-label="Enemy group" className={selectClass} value={s.enemyType} onChange={e=>patch({enemyType:e.target.value as WallSettings['enemyType']})}><option value="normal">Ordinary contact enemies</option><option value="boss">Boss contact (half Thorns, no BH / Orb damage)</option><option value="elite">Elite contact only (no BH / Orb damage)</option></select></label>
          <p className="text-xs text-muted-foreground">This is one homogeneous group, not the complete spawn mix. Elite mode covers contact hits only; it does not model Vampire drain, Ray shots or Scatter splitting. Test those separately; Fleet / Overcharge are outside this model.</p>
          <div className="grid grid-cols-2 gap-3">{field('Enemies per arriving batch','count',1,200,1)}{field('Each enemy attack interval (game s)','attackInterval',0.25,30)}</div>
          {toggle('Keep adding new batches','repeat')}
          {s.repeat&&field('New batch every (game s)','arrivalInterval',0.5,300)}
          <div className="grid grid-cols-2 gap-3">{field('Simulation duration (game s)','horizon',1,300)}{field('Enemy health on arrival %','enemyRemaining',0.01,100)}</div>
          {toggle('Repeated-hit heat-up (×1.04 per prior hit)','heat')}
          {toggle('Enemy protected: reduce Thorns, block ordinary Orbs','protected')}
          {s.protected&&field('Protection damage reduction %','protection',0,99)}
          <p className="text-xs text-muted-foreground">Attack interval is observed per enemy after control effects, not Tower Attack Speed. A batch first hits after one attack interval, then attacks in sync. New batches can overlap until killed. Pre-arrival heat-up is not included.</p>
          </>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>{s.threatsMode?'BH coverage for PCol':'BH & Orb clearing'}</CardTitle></CardHeader><CardContent className="space-y-4">
          {toggle('All modeled enemies are covered by the active Black Hole area','bhOn')}
          {s.bhOn&&<div className="grid grid-cols-2 gap-3">{!s.threatsMode && field('BH max-health damage % / game s','bhDamage',0,100)}{field('BH duration (game s)','bhDuration',0,300)}{field('BH cycle / cooldown (game s)','bhCooldown',0.25,300)}{field('First BH start (game s)','bhOffset',0,300)}</div>}
          <p className="text-xs text-muted-foreground">Set duration = cooldown for permanent BH. PCol mitigation applies to covered enemies, including Elite and Boss, during active windows. Immunity to BH damage / pull does not block PCol. BH does no HP damage to the modeled Elite / Boss threats.</p>
          {!s.threatsMode && toggle('An ordinary Orb will contact each eligible enemy','orbOn')}
          {!s.threatsMode&&s.orbOn&&field('Orb contact delay after arrival (game s)','orbDelay',0,300)}
          <p className="text-xs text-muted-foreground">{s.threatsMode ? 'BH and ordinary Orbs do not kill the modeled Scatter, Ray or Boss threats. Ordinary enemies are assumed cleared outside this Wall scenario. Orb Boss Hit is not included.' : <>Orb contact kills unprotected ordinary enemies. The delay must be estimated from your actual range / Orb path; speed and number of Orbs alone do not guarantee contact. No Boss Orb Hit, Elite or Fleet Orb damage is assumed. BH and Orb events at the same time as attacks are processed after attacks.</>}</p>
        </CardContent></Card>
      </div>
      <div className="space-y-5 md:sticky md:top-20">
        <Card className="border-primary/20 bg-primary/5"><CardHeader><CardTitle>Enemy damage limit for this scenario</CardTitle></CardHeader><CardContent className="space-y-4">
          {!scenario?<div className="text-sm space-y-2" role="status"><p>Enter Wall health and the actual regen stat to calculate.</p>{built.errors.map(e=><p key={e}>{e}</p>)}</div>:<>
            {damage.pcolOn && (scenario.pcolStatus === 'inactive') && <div role="alert" className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-3 text-sm space-y-2">
              <p><strong>PCol selected but NOT applied.</strong> Black Hole coverage is disabled or never active during this simulation.</p>
              {scenario.pcolStatus === 'inactive' && <Button variant="outline" className="h-auto whitespace-normal" onClick={()=>patch({bhOn:true,bhDuration:s.bhCooldown,bhOffset:'0'})}>Apply permanent BH coverage</Button>}
            </div>}
            <p className="text-sm"><strong>PCol status:</strong> {scenario.pcolStatus === 'permanent' ? 'Applied throughout (permanent BH)' : scenario.pcolStatus === 'windowed' ? 'Only applied during configured BH windows' : scenario.pcolStatus === 'off' ? 'Not selected' : 'Not applied'}</p>
            {run && enemy !== null && <div className="rounded-xl border bg-background p-4 text-sm space-y-2">
              <p>Your entered enemy damage: <strong>{f(enemy)}</strong></p>
              <p className={`font-semibold ${run.brokenAt===null?'text-green-700 dark:text-green-400':'text-red-700 dark:text-red-400'}`}>{run.brokenAt===null?`Wall holds for ${scenario.horizon} game seconds`:`Wall breaks at ${Number(run.brokenAt.toFixed(3))} game seconds`}</p>
              <p>First hit of first enabled threat, after reductions: <strong>{f(enemy*scenario.firstHitFactor)}</strong></p>
              <p>Time to heal that first hit: <strong>{scenario.regen > 0 ? `${Number((enemy*scenario.firstHitFactor/scenario.regen).toFixed(3))} game s` : 'No healing'}</strong></p>
              <p>First scheduled simultaneous attack: <strong>{f(enemy*(scenario.hits[0]?.weight ?? 0))}</strong></p>
              <p>Largest scheduled simultaneous attack: <strong>{f(enemy*largestBurstWeight)}</strong></p>
              <p>Scheduled average damage / game s: <strong>{f(enemy*averageWeight)}</strong></p>
              <p>Continuous Wall healing / game s: <strong>{f(scenario.regen)}</strong></p>
              <p>{enemy*averageWeight > scenario.regen ? 'Scheduled average incoming damage exceeds healing. Wall health provides a buffer, but can still run out.' : 'Healing covers scheduled average damage. Bursts can still break the Wall; use the simulated survival verdict.'}</p>
              <p className="text-xs text-muted-foreground">Scheduled damage assumes the Wall remains intact for the full duration; deaths and heat-up are included. Average damage alone does not determine survival.</p>
            </div>}
            <div><p className="text-sm text-muted-foreground">Maximum enemy damage for this setup over {scenario.horizon} game seconds</p><p className="mt-2 text-4xl font-semibold font-mono break-all">{limit===null?'No modeled hits':f(limit)}</p></div>
            <p className="text-sm">{damage.enemyIncludesPerk?'Compare with the in-game enemy stat, already including trade-off perk.':'Compare with enemy damage before the trade-off perk.'} Enemy damage must stay below this boundary in this scenario. Values shown are rounded.</p>
            <p className="text-sm">Effective Wall healing: <strong>{f(scenario.regen)} / game s</strong></p>
            <p className="text-xs text-muted-foreground">{s.regenMode === 'wall' ? 'Using final Wall Regen directly. Wall Regen % is not multiplied again.' : `Using Tower Regen × ${s.wallRegen}% Wall Regen. If your input is already Wall Regen, switch the Regen value source to Final Wall Regen.`}</p>
            <p className="text-xs text-muted-foreground">This limit uses Wall health, healing, reductions and the full attack schedule. Changing the test enemy damage changes the survival verdict, not the calculated limit.</p>
            <p className="text-sm">Wall Thorns per hit: <strong>{Number(scenario.thornPercent.toFixed(4))}% max enemy HP</strong></p>
            {s.threatsMode ? <div className="space-y-2 text-sm">
              {scenario.threatBreakdown.map(threat=><div key={threat.kind} className="rounded-lg border p-3">
                <p className="font-semibold">{threat.kind === 'scatter'?'Scatter family':threat.kind === 'ray'?'Ray':'Boss'}</p>
                <p>Scheduled hits: {threat.hits}; bodies: {threat.entities}.</p>
                <p>First encounter clears: {threat.firstClear === null?'not within this simulation':`${Number(threat.firstClear.toFixed(3))} game s`}.</p>
                {enemy!==null&&<p>Initial damage per hit: {f(enemy*threat.firstHitFactor)}.</p>}
              </div>)}
            </div> : <p className="text-sm">First batch: {scenario.firstCohortHits} hits per enemy{scenario.firstCohortDeath===null?' within the simulation (not killed yet)':`, cleared at ${Number(scenario.firstCohortDeath.toFixed(3))} game s`}.</p>}
            <p className="text-sm">Peak concurrent enemies: {scenario.peakEnemies}. Modeled attacks: {scenario.totalHits}. Scheduled kills with Wall intact: {scenario.killed} / {scenario.totalSpawned}.</p>
            {stress!==null&&<div className="border-t pt-3 text-sm"><p>Same scenario with Flame Bot and PCol mitigation removed:</p><p className="mt-1 text-xl font-mono">{f(stress)}</p><p className="mt-1 text-muted-foreground">Tests missed tagging / lost mitigation only. It keeps the same attack schedule; it is not a full control-failure simulation.</p></div>}
          </>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Test an enemy damage value</CardTitle></CardHeader><CardContent className="space-y-4">
          <Quantity label="Wall scenario enemy damage" value={damage.enemy} unit={damage.enemyUnit} onChange={onEnemyChange}/>
          {scenario&&run?<><p className={`text-lg font-semibold ${run.brokenAt===null?'text-green-700 dark:text-green-400':'text-red-700 dark:text-red-400'}`}>{run.brokenAt===null?`Wall holds for ${scenario.horizon} game seconds`:`Wall breaks at ${Number(run.brokenAt.toFixed(3))} game seconds`}</p><p className="text-sm">Lowest Wall health: {f(run.minimum)} ({Number((run.minimum/scenario.health*100).toFixed(2))}%). End health: {f(run.end)}.</p>
            <svg viewBox="0 0 600 220" className="w-full" role="img" aria-label="Wall health over simulated game time"><line x1="40" y1="30" x2="560" y2="30" stroke="currentColor" opacity="0.15"/><line x1="40" y1="180" x2="560" y2="180" stroke="currentColor" opacity="0.3"/><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"/><text x="0" y="25" fontSize="12" fill="currentColor">100%</text><text x="10" y="184" fontSize="12" fill="currentColor">0%</text><text x="40" y="208" fontSize="12" fill="currentColor">0s</text><text x="500" y="208" fontSize="12" fill="currentColor">{scenario.horizon}s</text></svg>
          </>:<p className="text-sm text-muted-foreground">Enter enemy damage to see the Wall health timeline. The damage boundary above does not require this input.</p>}
        </CardContent></Card>
        <div className="rounded-xl border p-4 text-sm space-y-3 leading-relaxed"><p><strong>Wall break is not guaranteed Tower death.</strong> The simulation stops at Wall break; it does not model rebuilding, invincibility or the Tower afterward.</p><p>Holding for this duration is not a promise of indefinite farming survival. Use observed repeat arrivals, or test lost mitigation coverage to stress the Wall. No automatic T16 wave-to-damage prediction is made.</p><p>The input enemy damage stays constant during the simulation. In the threat mode it is multiplied by each type&apos;s configured damage multiplier before heat-up and reductions. All times use game seconds, not real seconds at 5× game speed. Flame Bot and CF are assumed active on every modeled hit when checked; their uptime is not simulated. Checked Flame Bot coverage includes Scatter children by your full-coverage assumption; a missed child tag is not simulated. Defense Absolute, Sharp Fortitude stacking, Bot Bot, Vampire drain and Fleet attacks are excluded.</p></div>
        <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">Wall mechanic references</summary><div className="mt-3 flex flex-col gap-2 underline"><a href="https://the-tower-idle-tower-defense.fandom.com/wiki/Wall" target="_blank" rel="noreferrer">Wall Regen / Wall Thorns</a><a href="https://the-tower-idle-tower-defense.fandom.com/wiki/Black_Hole" target="_blank" rel="noreferrer">BH percentage damage</a><a href="https://the-tower-idle-tower-defense.fandom.com/wiki/Enemies" target="_blank" rel="noreferrer">Enemy immunities</a><a href="https://the-tower-idle-tower-defense.fandom.com/wiki/Frequently_Asked_Questions" target="_blank" rel="noreferrer">Repeated-hit heat-up</a></div></details>
      </div>
    </div>
    <Button variant="outline" onClick={()=>setS({...DEFAULT_WALL})}>Reset Wall inputs</Button>
  </div>
}
