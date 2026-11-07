export const UNITS = { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12, q: 1e15, Q: 1e18, s: 1e21, S: 1e24, O: 1e27, N: 1e30, D: 1e33 } as const
export type Unit = keyof typeof UNITS
export const PCOL = { Epic: 60, Legendary: 65, Mythic: 75, Ancestral: 90 } as const
export type DamageSettings = {
  health: string; healthUnit: Unit; enemy: string; enemyUnit: Unit
  defenseOn: boolean; defense: string
  flameOn: boolean; flame: string
  pcolOn: boolean; pcol: keyof typeof PCOL
  perkOn: boolean; perkLevel: string; enemyIncludesPerk: boolean
  cfOn: boolean; cf: string
}
export const DEFAULT_DAMAGE: DamageSettings = {
  health: '', healthUnit: 'T', enemy: '', enemyUnit: 'Q',
  defenseOn: true, defense: '98', flameOn: false, flame: '95',
  pcolOn: false, pcol: 'Ancestral', perkOn: false, perkLevel: '10',
  enemyIncludesPerk: true, cfOn: false, cf: '25',
}
export function amount(value: string, unit: Unit): number | null {
  if (!value.trim() || !(unit in UNITS)) return null
  const n = Number(value)
  const result = n * UNITS[unit]
  return Number.isFinite(result) && result >= 0 ? result : null
}
export function percent(value: string, max: number): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null
}
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '—'
  value = Number(value.toPrecision(5))
  const units = Object.entries(UNITS).reverse()
  const [unit, scale] = units.find(([, scale]) => value >= scale) ?? ['', 1]
  return `${Number((value / scale).toPrecision(5)).toLocaleString('en-US', { maximumFractionDigits: 6 })}${unit}`
}
export function calculateDamage(s: DamageSettings) {
  const health = amount(s.health, s.healthUnit)
  const enemy = amount(s.enemy, s.enemyUnit)
  const defense = s.defenseOn ? percent(s.defense, 98) : 0
  const flame = s.flameOn ? percent(s.flame, 95) : 0
  const cf = s.cfOn ? percent(s.cf, 25) : 0
  const level = s.perkOn ? percent(s.perkLevel, 10) : 0
  const pcol = s.pcolOn ? PCOL[s.pcol] : 0
  if ([defense, flame, cf, level].some(n => n === null) || !Number.isFinite(pcol)) return null
  if (s.perkOn && !Number.isInteger(level)) return null
  const perk = s.perkOn ? 50 + level! * 0.5 : 0
  const layers = [
    { name: 'Defense %', reduction: defense!, active: s.defenseOn },
    { name: 'Flame Bot', reduction: flame!, active: s.flameOn },
    { name: 'Primordial Collapse', reduction: pcol, active: s.pcolOn },
    { name: 'Chrono Field', reduction: cf!, active: s.cfOn },
  ].filter(layer => layer.active)
  const mitigation = layers.reduce((factor, layer) => factor * (1 - layer.reduction / 100), 1)
  const rawFactor = mitigation * (1 - perk / 100)
  // In-game enemy stats already include the selected trade-off perk.
  const inputFactor = s.enemyIncludesPerk ? mitigation : rawFactor
  return { health, enemy, layers, perk, rawFactor, mitigation, inputFactor,
    rawLimit: health === null ? null : health / rawFactor,
    displayedLimit: health === null ? null : health / inputFactor,
    hit: enemy === null ? null : enemy * inputFactor,
  }
}
