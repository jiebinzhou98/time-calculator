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
  return <label className="block space-y-2"><span className="text-[11px] text-muted-foreground">{label}</span><span className="flex gap-2"><Input className="h-12 font-mono text-lg bg-background" aria-label={label} type="number" min="0" step="any" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value,unit)} placeholder="Enter in-game value"/><select className={`${selectClass} max-w-24`} aria-label={`${label} unit`} value={unit} onChange={e=>onChange(value,e.target.value as Unit)}>{Object.keys(UNITS).map(u=><option key={u} value={u}>{u||'No unit'}</option>)}</select></span></label>
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
    return <label className="block space-y-2 text-xs"><span className="text-muted-foreground">{label}</span><Input className="h-12 font-mono text-lg bg-background" aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step} value={String(s[key])} onChange={e=>patch({[key]:e.target.value})}/></label>
  }
  function toggle(label:string,key:'repeat'|'protected'|'heat'|'bhOn'|'orbOn'|'threatsMode') {
    return <label className="flex items-center gap-3 text-sm font-medium"><input className="size-5 accent-primary" type="checkbox" checked={s[key]} onChange={e=>patch({[key]:e.target.checked})}/>{label}</label>
  }
  const points=run&&scenario?run.trace.map(p=>`${40+p.time/scenario.horizon*520},${180-Math.max(0,p.health)/scenario.health*150}`).join(' '):''
  const healthPercent=scenario&&run?Math.max(0,run.minimum/scenario.health*100):0
  return <div className="console-wall-grid grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-start">
    <div className="console-wall-inputs space-y-4 min-w-0">
        <Card><CardHeader><CardTitle className="flex items-center justify-between text-sm">Core parameters<span className="text-[10px] font-normal text-muted-foreground">LIVE CALCULATION</span></CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="grid xl:grid-cols-2 gap-4">
            <Quantity label="Fortified Wall maximum health" value={s.health} unit={s.healthUnit} onChange={(health,healthUnit)=>patch({health,healthUnit})}/>
            <Quantity label={s.regenMode==='tower'?'Tower Health Regen / game second':'Final Wall Regen / game second'} value={s.regen} unit={s.regenUnit} onChange={(regen,regenUnit)=>patch({regen,regenUnit})}/>
          </div>
          <Quantity label="Wall scenario enemy damage" value={damage.enemy} unit={damage.enemyUnit} onChange={onEnemyChange}/>
          <p className="console-note">Use the final in-run Wall health cap. Units: 1Q = 1,000q.</p>
          <details className="border-t border-border pt-3"><summary className="text-xs text-muted-foreground">Regen source & starting health</summary><div className="space-y-4 mt-4">
            <label className="block space-y-2 text-xs"><span>Regen value source</span><select className={selectClass} value={s.regenMode} onChange={e=>patch({regenMode:e.target.value as WallSettings['regenMode']})}><option value="tower">Tower Health Regen × Wall Regen %</option><option value="wall">Final Wall Regen (already includes bonuses)</option></select></label>
            {s.regenMode==='tower'&&field('Wall Regen % (lab 20 = 200%)','wallRegen',0,1000)}
            {field('Starting Wall health %','startPercent',0.01,100)}
            <p className="console-note">Final Wall Regen includes all bonuses. Tower Regen is multiplied by Wall Regen %. Healing stays continuous during combat.</p>
          </div></details>
        </CardContent></Card>

{reductions}
<details className="console-detail"><summary>Thorns & enemy encounters<span className="ml-auto text-[10px] text-muted-foreground font-normal">{s.threatsMode?`S ${s.scatterCount} · R ${s.rayCount} · B ${s.bossCount}`:'Custom'}</span></summary><div className="space-y-4">
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
        </div></details>
<details className="console-detail"><summary>Black Hole coverage<span className="ml-auto text-[10px] text-muted-foreground font-normal">{s.bhOn?(s.bhDuration===s.bhCooldown?'Permanent':'Windowed'):'Off'}</span></summary><div className="space-y-4">
          {toggle('All modeled enemies are covered by the active Black Hole area','bhOn')}
          {s.bhOn&&<div className="grid grid-cols-2 gap-3">{!s.threatsMode && field('BH max-health damage % / game s','bhDamage',0,100)}{field('BH duration (game s)','bhDuration',0,300)}{field('BH cycle / cooldown (game s)','bhCooldown',0.25,300)}{field('First BH start (game s)','bhOffset',0,300)}</div>}
          <p className="text-xs text-muted-foreground">Set duration = cooldown for permanent BH. PCol mitigation applies to covered enemies, including Elite and Boss, during active windows. Immunity to BH damage / pull does not block PCol. BH does no HP damage to the modeled Elite / Boss threats.</p>
          {!s.threatsMode && toggle('An ordinary Orb will contact each eligible enemy','orbOn')}
          {!s.threatsMode&&s.orbOn&&field('Orb contact delay after arrival (game s)','orbDelay',0,300)}
          <p className="text-xs text-muted-foreground">{s.threatsMode ? 'BH and ordinary Orbs do not kill the modeled Scatter, Ray or Boss threats. Ordinary enemies are assumed cleared outside this Wall scenario. Orb Boss Hit is not included.' : <>Orb contact kills unprotected ordinary enemies. The delay must be estimated from your actual range / Orb path; speed and number of Orbs alone do not guarantee contact. No Boss Orb Hit, Elite or Fleet Orb damage is assumed. BH and Orb events at the same time as attacks are processed after attacks.</>}</p>
        </div></details><div className="flex items-center justify-between px-1"><span className="text-[10px] text-muted-foreground">Settings saved on this device</span><Button variant="ghost" className="h-8 text-[11px] text-muted-foreground" onClick={()=>setS({...DEFAULT_WALL})}>Reset Wall inputs</Button></div>
    </div>
      <div className="console-wall-results space-y-4 min-w-0 lg:sticky lg:top-6">
        <Card className="console-result"><CardHeader><CardTitle className="flex items-center justify-between text-sm">Survival readout<span className="text-[10px] font-normal text-muted-foreground">WALL ONLY</span></CardTitle></CardHeader><CardContent>
          {!scenario?<div className="console-note space-y-2" role="status"><p className="text-foreground">Add your Wall health and regen to begin.</p>{built.errors.map(error=><p key={error}>{error}</p>)}</div>:<>
            {damage.pcolOn&&scenario.pcolStatus==='inactive'&&<div role="alert" className="border border-amber-500/50 bg-amber-500/10 p-3 rounded-lg text-xs mb-4 space-y-2"><p>PCol selected, but BH coverage is off.</p><Button variant="outline" className="h-auto whitespace-normal text-xs" onClick={()=>patch({bhOn:true,bhDuration:s.bhCooldown,bhOffset:'0'})}>Apply permanent BH coverage</Button></div>}
            <p className="text-[11px] text-muted-foreground">First hit · after reductions</p>
            <p className="console-metric text-5xl text-primary mt-2 mb-2" aria-live="polite">{enemy===null?'—':f(enemy*scenario.firstHitFactor)}</p>
            <p className="console-note">Per enemy, using the first enabled threat.</p>
            {run&&<p className={`text-xs mt-4 flex items-center gap-2 ${run.brokenAt===null?'text-primary':'text-destructive'}`}><span className="size-1.5 rounded-full bg-current shrink-0"/>{run.brokenAt===null?`Wall holds for ${scenario.horizon} game seconds`:`Wall breaks at ${Number(run.brokenAt.toFixed(3))} game seconds`}</p>}
            {run&&<div className="mt-6"><div className="flex justify-between text-[11px] text-muted-foreground mb-2 gap-2"><span>Lowest Wall health</span><span className="font-mono text-foreground">{f(run.minimum)} · {Number(healthPercent.toFixed(2))}%</span></div><div className="console-health-bar"><div style={{width:`${healthPercent}%`}}/></div></div>}
            <div className="mt-4">
              <div className="console-stat-row"><span>Heal back one first hit</span><strong>{enemy!==null&&scenario.regen>0?`${Number((enemy*scenario.firstHitFactor/scenario.regen).toFixed(3))}s`:'—'}</strong></div>
              <div className="console-stat-row"><span>Continuous Wall healing</span><strong>{f(scenario.regen)}/s</strong></div>
              <div className="console-stat-row"><span>BH / PCol coverage</span><strong>{scenario.pcolStatus==='permanent'?'Permanent':scenario.pcolStatus==='windowed'?'Windowed':scenario.pcolStatus==='off'?'Not selected':'Not applied'}</strong></div>
            </div>
            <div className="mt-5 pt-5 border-t border-border"><p className="text-[11px] text-muted-foreground">Enemy damage boundary · {scenario.horizon} game seconds</p><p className="console-metric text-3xl mt-2">{limit===null?'No modeled hits':f(limit)}</p><p className="console-note mt-2">{damage.enemyIncludesPerk?'Compare with the in-game stat, including the perk.':'Compare with damage before the trade-off perk.'} Stay below this boundary for this encounter. Rounded values.</p></div>
          </>}
        </CardContent></Card>
        {scenario&&<details className="console-detail"><summary>Damage breakdown</summary><div className="space-y-4">
          {enemy!==null&&<div>
            <div className="console-stat-row"><span>Entered enemy damage</span><strong>{f(enemy)}</strong></div>
            <div className="console-stat-row"><span>First simultaneous attack</span><strong>{f(enemy*(scenario.hits[0]?.weight??0))}</strong></div>
            <div className="console-stat-row"><span>Largest scheduled burst</span><strong>{f(enemy*largestBurstWeight)}</strong></div>
            <div className="console-stat-row"><span>Scheduled average damage</span><strong>{f(enemy*averageWeight)}/s</strong></div>
            <p className="console-note mt-3">{enemy*averageWeight>scenario.regen?'Average damage exceeds healing. Wall health acts as a buffer.':'Healing covers average damage; bursts can still break the Wall.'} Scheduled damage assumes an intact Wall throughout.</p>
          </div>}
          <p className="console-note">{s.regenMode==='wall'?'Final Wall Regen is used directly.':`Tower Regen × ${s.wallRegen}% Wall Regen.`}</p>
          <p className="console-note">Thorns per ordinary hit: {Number(scenario.thornPercent.toFixed(4))}% max health. Bosses take half.</p>
          {s.threatsMode?scenario.threatBreakdown.map(threat=><div key={threat.kind} className="border-t pt-3 text-xs"><div className="flex justify-between gap-2"><span className="capitalize font-medium">{threat.kind}</span><span className="text-muted-foreground">{threat.entities} bodies · {threat.hits} hits</span></div><p className="console-note mt-2">First clear: {threat.firstClear===null?'outside simulation':`${Number(threat.firstClear.toFixed(3))}s`}.{enemy!==null?` First hit: ${f(enemy*threat.firstHitFactor)}.`:''}</p></div>):<p className="console-note">First batch: {scenario.firstCohortHits} hits per enemy; clears {scenario.firstCohortDeath===null?'outside simulation':`${scenario.firstCohortDeath}s`}.</p>}
          <p className="console-note">Peak enemies: {scenario.peakEnemies} · Hits: {scenario.totalHits} · Potential kills: {scenario.killed}/{scenario.totalSpawned}</p>
          {stress!==null&&<div className="pt-3 border-t"><p className="console-note">Without Flame Bot or PCol mitigation</p><p className="console-metric text-xl mt-1">{f(stress)}</p><p className="console-note mt-2">Same schedule; missed mitigation only, not full control failure.</p></div>}
        </div></details>}
        {scenario&&run&&<details className="console-detail"><summary>Wall health timeline<span className="ml-auto text-[10px] text-muted-foreground">{scenario.horizon}s</span></summary><div>
          <svg viewBox="0 0 600 220" className="w-full text-primary" role="img" aria-label="Wall health over simulated game time"><line x1="40" y1="30" x2="560" y2="30" stroke="currentColor" opacity="0.12"/><line x1="40" y1="180" x2="560" y2="180" stroke="currentColor" opacity="0.2"/><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"/><text x="0" y="25" fontSize="12" fill="currentColor">100%</text><text x="10" y="184" fontSize="12" fill="currentColor">0%</text><text x="40" y="208" fontSize="12" fill="currentColor">0s</text><text x="510" y="208" fontSize="12" fill="currentColor">{scenario.horizon}s</text></svg>
          <p className="console-note">End health: {f(run.end)}. Simulation stops at Wall break, not Tower death.</p>
        </div></details>}
<details className="console-detail"><summary>Model assumptions & limits</summary><div className="console-note space-y-3"><p><strong>Wall break is not guaranteed Tower death.</strong> The simulation stops at Wall break; it does not model rebuilding, invincibility or the Tower afterward.</p><p>Holding for this duration is not a promise of indefinite farming survival. Use observed repeat arrivals, or test lost mitigation coverage to stress the Wall. No automatic T16 wave-to-damage prediction is made.</p><p>The input enemy damage stays constant during the simulation. In the threat mode it is multiplied by each type&apos;s configured damage multiplier before heat-up and reductions. All times use game seconds, not real seconds at 5× game speed. Flame Bot and CF are assumed active on every modeled hit when checked; their uptime is not simulated. Checked Flame Bot coverage includes Scatter children by your full-coverage assumption; a missed child tag is not simulated. Defense Absolute, Sharp Fortitude stacking, Bot Bot, Vampire drain and Fleet attacks are excluded.</p></div></details><p className="console-note px-1">Encounter estimates, not a guaranteed farming wave. All times use game seconds.</p>
    </div>
  </div>
}
