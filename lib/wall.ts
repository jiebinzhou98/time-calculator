import { amount, calculateDamage, PCOL, type DamageSettings, type Unit } from './damage'

export type WallSettings = {
  health: string; healthUnit: Unit; startPercent: string
  regen: string; regenUnit: Unit; wallRegen: string; regenMode: 'tower' | 'wall'
  thorns: string; wallThorns: string; enemyType: 'normal' | 'boss' | 'elite'
  count: string; attackInterval: string; repeat: boolean; arrivalInterval: string
  horizon: string; enemyRemaining: string; heat: boolean
  protected: boolean; protection: string
  bhOn: boolean; bhDamage: string; bhDuration: string; bhCooldown: string; bhOffset: string
  orbOn: boolean; orbDelay: string
  regenTiming: 'continuous' | 'ticks'
}
export const DEFAULT_WALL: WallSettings = {
  health: '', healthUnit: 'q', startPercent: '100',
  regen: '', regenUnit: 'T', wallRegen: '200', regenMode: 'tower',
  thorns: '110', wallThorns: '13', enemyType: 'normal',
  count: '10', attackInterval: '1', repeat: true, arrivalInterval: '5',
  horizon: '120', enemyRemaining: '100', heat: true,
  protected: false, protection: '60',
  bhOn: false, bhDamage: '2', bhDuration: '30', bhCooldown: '50', bhOffset: '0',
  orbOn: false, orbDelay: '2', regenTiming: 'ticks',
}
export type HitEvent = { time: number; weight: number; hits: number }
export type WallRun = { brokenAt: number | null; minimum: number; end: number; trace: {time:number; health:number}[] }
export function buildWallScenario(s: WallSettings, d: DamageSettings) {
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
  // PCol is only applied to ordinary enemies explicitly exposed to an active BH.
  // Immune enemies receive no assumed PCol mitigation in this scenario.
  const baseReduction = calculateDamage({ ...d, pcolOn: false })!.inputFactor
  const pcolMultiplier = d.pcolOn ? 1 - PCOL[d.pcol] / 100 : 1
  const thornFraction = thorns / 100 * wallThorns / 100
    * (s.enemyType === 'boss' ? 0.5 : 1) * (1 - protection / 100)
  function bhActive(time: number) {
    if (!s.bhOn || !basic || time < bhOffset) return false
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
      // Conservatively take simultaneous attacks before Orb/BH kills and regen ticks.
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
        if (bhActive(t)) enemyHP -= bhDamage / 100
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
  const scenario = { health:hp, startHealth:hp*startPercent/100, regen, horizon, hits, totalHits, totalSpawned,
    killed, peakEnemies, firstCohortHits, firstCohortDeath, thornPercent:thornFraction*100, regenTiming:s.regenTiming }
  return {errors, scenario}
}
export type WallScenario = NonNullable<ReturnType<typeof buildWallScenario>['scenario']>

export function runWall(s: WallScenario, enemyDamage: number, trace = false): WallRun {
  let health = s.startHealth, min = health, last = 0
  const points = trace ? [{time:0,health}] : []
  function heal(to: number, beforeHit: boolean) {
    const elapsed = s.regenTiming === 'continuous' ? to-last
      : Math.max(0, (beforeHit ? Math.ceil(to - 1e-8)-1 : Math.floor(to+1e-8)) - Math.floor(last+1e-8))
    if (elapsed > 0) health = Math.min(s.health,health + s.regen*elapsed)
  }
  for (const event of s.hits) {
    heal(event.time, true)
    if (trace) points.push({time:event.time,health})
    health -= enemyDamage * event.weight
    min = Math.min(min,health)
    if (trace) points.push({time:event.time,health:Math.max(0,health)})
    if (health <= 0) return {brokenAt:event.time,minimum:0,end:0,trace:points}
    // A regen tick at the exact hit time is allowed only after the full burst.
    if (s.regenTiming === 'ticks' && Math.abs(event.time-Math.round(event.time))<1e-8) health=Math.min(s.health,health+s.regen)
    last=event.time
  }
  heal(s.horizon,false)
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
