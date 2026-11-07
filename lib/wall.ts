import { amount, calculateDamage, PCOL, type DamageSettings, type Unit } from './damage'

export type ThreatKind = 'scatter' | 'ray' | 'boss'
export type ThreatFields = 'Count' | 'First' | 'Interval' | 'Arrival' | 'Multiplier'
export type ThreatSettings = Record<`${ThreatKind}${ThreatFields}`, string>
export type WallSettings = ThreatSettings & {
  threatsMode: boolean
  scatterSplits: string
  health: string; healthUnit: Unit; startPercent: string
  regen: string; regenUnit: Unit; wallRegen: string; regenMode: 'tower' | 'wall'
  thorns: string; wallThorns: string; enemyType: 'normal' | 'boss' | 'elite'
  count: string; attackInterval: string; repeat: boolean; arrivalInterval: string
  horizon: string; enemyRemaining: string; heat: boolean
  protected: boolean; protection: string
  bhOn: boolean; bhDamage: string; bhDuration: string; bhCooldown: string; bhOffset: string
  orbOn: boolean; orbDelay: string
}
export const DEFAULT_WALL: WallSettings = {
  threatsMode: true, scatterSplits: '4',
  scatterCount:'1', scatterFirst:'1', scatterInterval:'1', scatterArrival:'0', scatterMultiplier:'1',
  rayCount:'1', rayFirst:'30', rayInterval:'30', rayArrival:'0', rayMultiplier:'2',
  bossCount:'1', bossFirst:'1', bossInterval:'1', bossArrival:'0', bossMultiplier:'1',
  health: '', healthUnit: 'q', startPercent: '100',
  regen: '', regenUnit: 'T', wallRegen: '200', regenMode: 'tower',
  thorns: '110', wallThorns: '13', enemyType: 'normal',
  count: '10', attackInterval: '1', repeat: true, arrivalInterval: '5',
  horizon: '120', enemyRemaining: '100', heat: true,
  protected: false, protection: '60',
  bhOn: false, bhDamage: '2', bhDuration: '30', bhCooldown: '50', bhOffset: '0',
  orbOn: false, orbDelay: '2',
}
export type HitEvent = { time: number; weight: number; hits: number }
export type WallRun = { brokenAt: number | null; minimum: number; end: number; trace: {time:number; health:number}[] }
function buildOrdinaryScenario(s: WallSettings, d: DamageSettings) {
  const errors: string[] = []
  function number(key: keyof WallSettings, min: number, max: number, integer = false) {
    const value = Number(s[key])
    if (String(s[key]).trim() === '' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      errors.push(`${key}: ${integer ? 'integer ' : ''}${min}–${max}`)
      return min
    }
    return value
  }
  const health = amount(s.health, s.healthUnit)
  const regenValue = amount(s.regen, s.regenUnit)
  if (health === null || health <= 0) errors.push('Enter positive fortified Wall health.')
  if (regenValue === null) errors.push('Enter non-negative health regen per game second.')
  const startPercent = number('startPercent', 0.01, 100)
  const wallRegen = s.regenMode === 'tower' ? number('wallRegen', 0, 1000) : 100
  const thorns = number('thorns', 0, 1000)
  const wallThorns = number('wallThorns', 0, 100)
  const count = number('count', 1, 200, true)
  const attackInterval = number('attackInterval', 0.25, 30)
  const arrivalInterval = s.repeat ? number('arrivalInterval', 0.5, 300) : 300
  const horizon = number('horizon', 1, 300)
  const enemyRemaining = number('enemyRemaining', 0.01, 100)
  const protection = s.protected ? number('protection', 0, 99) : 0
  const bhDamage = s.bhOn ? number('bhDamage', 0, 100) : 0
  const bhDuration = s.bhOn ? number('bhDuration', 0, 300) : 0
  const bhCooldown = s.bhOn ? number('bhCooldown', 0.25, 300) : 1
  const bhOffset = s.bhOn ? number('bhOffset', 0, 300) : 0
  const orbDelay = s.orbOn ? number('orbDelay', 0, 300) : Infinity
  if (s.bhOn && bhDuration > bhCooldown) errors.push('BH duration must not exceed cooldown. Use equal values for permanent BH.')
  const mitigation = calculateDamage(d)
  if (!mitigation) errors.push('Check enabled damage reduction values above.')
  if (errors.length) return { errors, scenario: null }
  const hp = health!, regen = regenValue! * wallRegen / 100
  const basic = s.enemyType === 'normal'
  // BH damage / pull immunity does not prevent PCol mitigation inside its area.
  const baseReduction = calculateDamage({ ...d, pcolOn: false })!.inputFactor
  const pcolMultiplier = d.pcolOn ? 1 - PCOL[d.pcol] / 100 : 1
  const thornFraction = thorns / 100 * wallThorns / 100
    * (s.enemyType === 'boss' ? 0.5 : 1) * (1 - protection / 100)
  function bhActive(time: number) {
    if (!s.bhOn || time < bhOffset) return false
    const phase = ((time - bhOffset) % bhCooldown + bhCooldown) % bhCooldown
    return phase < bhDuration - 1e-8
  }
  const events = new Map<number, HitEvent>()
  let totalHits = 0, totalSpawned = 0, killed = 0, peakEnemies = 0
  const changes: {time:number; delta:number}[] = []
  let firstCohortHits = 0, firstCohortDeath: number | null = null
  const arrivals = s.repeat ? Math.ceil(horizon / arrivalInterval - 1e-9) : 1
  let operations = 0
  for (let cohort = 0; cohort < arrivals; cohort++) {
    const arrival = cohort * arrivalInterval
    totalSpawned += count
    changes.push({time:arrival, delta:count})
    let enemyHP = enemyRemaining / 100, hitIndex = 0, nextAttack = arrival + attackInterval
    let nextBH = Math.floor(arrival + 1e-8) + 1
    const orbTime = basic && !s.protected && s.orbOn ? arrival + orbDelay : Infinity
    let death: number | null = null
    while (enemyHP > 1e-10) {
      if (++operations > 100000) return {errors:['Scenario too dense: shorten duration or increase arrival / attack intervals.'],scenario:null}
      const t = Math.min(nextAttack, nextBH, orbTime)
      if (t > horizon + 1e-8) break
      // Conservatively take simultaneous attacks before Orb/BH kills with no healing time between them.
      if (Math.abs(t - nextAttack) < 1e-7) {
        const key = Math.round(t * 1e6) / 1e6
        const weight = count * Math.pow(s.heat ? 1.04 : 1, hitIndex)
          * baseReduction * (bhActive(t) ? pcolMultiplier : 1)
        const old = events.get(key)
        events.set(key, {time:key, weight: (old?.weight ?? 0) + weight, hits:(old?.hits ?? 0)+count})
        totalHits += count
        hitIndex++
        enemyHP -= thornFraction
        nextAttack = arrival + (hitIndex + 1) * attackInterval
      }
      if (Math.abs(t - nextBH) < 1e-7) {
        if (basic && bhActive(t)) enemyHP -= bhDamage / 100
        nextBH++
      }
      if (Math.abs(t - orbTime) < 1e-7) enemyHP = 0
      if (enemyHP <= 1e-10) { death = t; break }
    }
    if (death !== null) { killed += count; changes.push({time:death,delta:-count}) }
    if (cohort === 0) { firstCohortHits = hitIndex; firstCohortDeath = death }
  }
  changes.sort((a,b) => a.time-b.time || b.delta-a.delta)
  let alive = 0
  for (const c of changes) { alive += c.delta; peakEnemies = Math.max(peakEnemies, alive) }
  const hits = [...events.values()].sort((a,b)=>a.time-b.time)
  const pcolStatus = !d.pcolOn ? 'off'
    : !s.bhOn || bhDuration === 0 || bhOffset >= horizon ? 'inactive'
    : bhDuration === bhCooldown && bhOffset === 0 ? 'permanent' : 'windowed'
  const scenario = { pcolStatus, firstHitFactor:baseReduction * (bhActive(attackInterval) ? pcolMultiplier : 1), health:hp, startHealth:hp*startPercent/100, regen, horizon, hits, totalHits, totalSpawned,
    killed, peakEnemies, firstCohortHits, firstCohortDeath, thornPercent:thornFraction*100, threatBreakdown: [] as {kind:ThreatKind;hits:number;firstHitFactor:number;entities:number;firstClear:number|null}[] }
  return {errors, scenario}
}
export type WallScenario = NonNullable<ReturnType<typeof buildOrdinaryScenario>['scenario']>

export function buildWallScenario(s: WallSettings, d: DamageSettings): {errors:string[];scenario:WallScenario|null} {
  if (!s.threatsMode) return buildOrdinaryScenario(s,d)
  // Reuse common health / regen / reduction validation; ordinary attackers are never added.
  const common=buildOrdinaryScenario({...s,enemyType:'elite',count:'1',attackInterval:'1',repeat:false,orbOn:false,bhDamage:'0'},d)
  if (!common.scenario) return common
  const base=common.scenario
  const errors:string[]=[]
  function number(key:keyof WallSettings,min:number,max:number,integer=false) {
    const n=Number(s[key])
    if (!String(s[key]).trim() || !Number.isFinite(n) || n<min || n>max || (integer&&!Number.isInteger(n))) {
      errors.push(`${key}: ${integer?'integer ':''}${min}–${max}`)
      return min
    }
    return n
  }
  const splits=number('scatterSplits',0,4,true)
  const lanes=(['scatter','ray','boss'] as const).map(kind=>{
    const count=number(`${kind}Count`,0,8,true)
    return {kind,count,
      first:count?number(`${kind}First`,0,300):0,
      interval:count?number(`${kind}Interval`,0.25,300):1,
      arrival:count?number(`${kind}Arrival`,0,300):0,
      multiplier:count?number(`${kind}Multiplier`,0.001,1000):1}
  })
  if (!lanes.some(l=>l.count>0)) errors.push('Enable at least one threat by entering a count above zero.')
  if (errors.length) return {errors,scenario:null}
  const reduction=calculateDamage({...d,pcolOn:false})!.inputFactor
  const pcol=d.pcolOn?1-PCOL[d.pcol]/100:1
  const thorn=Number(s.thorns)/100*Number(s.wallThorns)/100*(s.protected?1-Number(s.protection)/100:1)
  const bhActive=(time:number)=>s.bhOn && time>=Number(s.bhOffset) &&
    ((time-Number(s.bhOffset))%Number(s.bhCooldown))<Number(s.bhDuration)-1e-8
  const events=new Map<number,HitEvent>()
  const changes:{time:number;delta:number}[]=[]
  const breakdown:WallScenario['threatBreakdown']=[]
  let totalHits=0,totalSpawned=0,killed=0,operations=0
  for (const lane of lanes) {
    if (!lane.count) continue
    let laneHits=0,laneEntities=0,firstClear:number|null=null
    const families=lane.arrival>0?Math.max(1,Math.ceil((base.horizon-lane.first)/lane.arrival+1e-9)):1
    for (let family=0;family<families;family++) {
      const first=lane.first+family*lane.arrival
      if (first>base.horizon) continue
      let generationStart=first
      const generations=lane.kind==='scatter'?splits+1:1
      let cleared:number|null=null
      for (let generation=0;generation<generations;generation++) {
        const population=lane.count*2**generation
        // Children are new full-health enemies relative to their own maximum HP.
        // No automatic damage halving or Flame Bot inheritance is inferred: checked
        // reductions represent the user's confirmed full coverage on every hit.
        let hp=generation===0?Number(s.enemyRemaining)/100:1
        let hit=0
        const retaliation=thorn*(lane.kind==='boss'?.5:1)
        totalSpawned+=population; laneEntities+=population
        changes.push({time:generationStart,delta:population})
        let died=false
        while (generationStart+hit*lane.interval<=base.horizon+1e-8) {
          if (++operations>100000) return {errors:['Threat schedule too dense. Reduce counts / repeats or shorten duration.'],scenario:null}
          const time=Math.round((generationStart+hit*lane.interval)*1e6)/1e6
          const weight=population*lane.multiplier*reduction*Math.pow(s.heat?1.04:1,hit)*(bhActive(time)?pcol:1)
          const old=events.get(time)
          events.set(time,{time,weight:(old?.weight??0)+weight,hits:(old?.hits??0)+population})
          totalHits+=population;laneHits+=population
          hp-=retaliation
          hit++
          if (hp<=1e-10) {
            killed+=population; changes.push({time,delta:-population})
            cleared=time; generationStart=time+lane.interval; died=true; break
          }
        }
        if (!died) {cleared=null;break}
        if (generationStart>base.horizon && generation<generations-1) {cleared=null;break}
      }
      if (family===0) firstClear=cleared
    }
    breakdown.push({kind:lane.kind,hits:laneHits,entities:laneEntities,firstClear,
      firstHitFactor:lane.multiplier*reduction*(bhActive(lane.first)?pcol:1)})
  }
  changes.sort((a,b)=>a.time-b.time||b.delta-a.delta)
  let alive=0,peakEnemies=0
  for (const change of changes) {alive+=change.delta;peakEnemies=Math.max(peakEnemies,alive)}
  const hits=[...events.values()].sort((a,b)=>a.time-b.time)
  return {errors:[],scenario:{...base,hits,totalHits,totalSpawned,killed,peakEnemies,
    firstHitFactor:breakdown[0]?.firstHitFactor??0,firstCohortHits:0,firstCohortDeath:null,
    threatBreakdown:breakdown}}
}

export function runWall(s: WallScenario, enemyDamage: number, trace = false): WallRun {
  let health = s.startHealth, min = health, last = 0
  const points = trace ? [{time:0,health}] : []
  function heal(to: number) {
    // Healing runs for every elapsed game second, without a reset or delay on hits.
    health = Math.min(s.health, health + s.regen * Math.max(0, to - last))
  }
  for (const event of s.hits) {
    heal(event.time)
    if (trace) points.push({time:event.time,health})
    health -= enemyDamage * event.weight
    min = Math.min(min,health)
    if (trace) points.push({time:event.time,health:Math.max(0,health)})
    if (health <= 0) return {brokenAt:event.time,minimum:0,end:0,trace:points}
    last=event.time
  }
  heal(s.horizon)
  if (trace) points.push({time:s.horizon,health})
  return {brokenAt:null,minimum:Math.max(0,min),end:health,trace:points}
}

export function wallDamageLimit(s: WallScenario) {
  if (!s.hits.length) return null
  const maxWeight = s.hits.reduce((max,e)=>Math.max(max,e.weight),0)
  let low=0, high=s.health/maxWeight
  for (let i=0;i<48;i++) {
    const middle=(low+high)/2
    if (runWall(s,middle).brokenAt===null) low=middle
    else high=middle
  }
  return (low+high)/2
}
