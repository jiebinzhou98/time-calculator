"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { calculateDamage, DEFAULT_DAMAGE, formatAmount, PCOL, UNITS, type DamageSettings, type Unit } from "@/lib/damage"

import { WallSimulator } from "@/components/wall-simulator"

const STORAGE_KEY = "time-calculator-damage-v1"
const selectClass = "h-11 rounded-md border border-input bg-background px-3 text-sm"

function AmountInput({ label, value, unit, onChange }: {
  label: string; value: string; unit: Unit; onChange: (value: string, unit: Unit) => void
}) {
  return <label className="block space-y-2">
    <span className="text-sm font-medium">{label}</span>
    <span className="flex gap-2">
      <Input aria-label={label} className="h-11" type="number" min="0" step="any" inputMode="decimal" placeholder="Enter value" value={value} onChange={e => onChange(e.target.value, unit)} />
      <select aria-label={`${label} unit`} className={selectClass} value={unit} onChange={e => onChange(value, e.target.value as Unit)}>
        {Object.keys(UNITS).map(u => <option key={u} value={u}>{u || 'No unit'}</option>)}
      </select>
    </span>
  </label>
}

export default function DamagePage() {
  const [mode, setMode] = useState<"single" | "wall">("wall")
  const [settings, setSettings] = useState<DamageSettings>(DEFAULT_DAMAGE)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const next = { ...DEFAULT_DAMAGE }
        for (const key of Object.keys(DEFAULT_DAMAGE) as (keyof DamageSettings)[]) {
          if (typeof saved[key] === typeof DEFAULT_DAMAGE[key]) Object.assign(next, { [key]: saved[key] })
        }
        if (!(next.healthUnit in UNITS)) next.healthUnit = 'T'
        if (!(next.enemyUnit in UNITS)) next.enemyUnit = 'Q'
        if (!(next.pcol in PCOL)) next.pcol = 'Ancestral'
        setSettings(next)
      }
    } catch { /* Keep defaults if saved data is unavailable. */ }
    setLoaded(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (loaded) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* Calculator works without storage. */ }
    }
  }, [settings, loaded])
  function patch(update: Partial<DamageSettings>) { setSettings(prev => ({ ...prev, ...update })) }
  const result = calculateDamage(settings)
  const fmt = (n: number | null | undefined) => n == null ? '—' : formatAmount(n)
  const validHealth = result?.health != null && result.health > 0
  const hasEnemy = settings.enemy.trim() !== ''
  const survive = validHealth && result?.hit != null && result.hit < result.health!
  function layer(toggle: 'defenseOn' | 'flameOn' | 'pcolOn' | 'perkOn' | 'cfOn', title: string, description: string, control: React.ReactNode) {
    return <div className="rounded-xl border p-4 space-y-3">
      <label className="flex items-center gap-3 font-medium cursor-pointer">
        <input type="checkbox" className="size-5 accent-primary" checked={settings[toggle]} onChange={e => patch({ [toggle]: e.target.checked })} />{title}
      </label>
      <p className="text-sm text-muted-foreground">{description}</p>
      <fieldset disabled={!settings[toggle]} className="disabled:opacity-40">{control}</fieldset>
    </div>
  }
  function percentInput(label: string, field: 'defense' | 'flame' | 'cf' | 'perkLevel', max: number) {
    return <label className="flex items-center gap-3 text-sm"><span>{label}</span><Input aria-label={label} className="h-11 max-w-28" type="number" inputMode="decimal" min="0" max={max} step={field === 'perkLevel' ? 1 : 'any'} value={settings[field]} onChange={e => patch({ [field]: e.target.value })} /></label>
  }
  const reductions = (<Card><CardHeader><CardTitle>Active reductions</CardTitle></CardHeader><CardContent className="space-y-3">
            {layer('defenseOn', 'Defense %', 'Use the total shown in-game, including card, labs and perks. Maximum 98%.', percentInput('Defense % (0–98)', 'defense', 98))}
            {layer('flameOn', 'Flame Bot', 'Applies only to an enemy tagged by Flame Bot. Enter its actual damage reduction, up to 95%.', percentInput('Flame Bot reduction %', 'flame', 95))}
            {layer('pcolOn', 'Primordial Collapse (PCol)', 'Assumes this enemy is affected by the module inside a Black Hole. Black Hole being active alone is not sufficient.', <label className="flex items-center gap-3 text-sm">Rarity<select aria-label="PCol rarity" className={selectClass} value={settings.pcol} onChange={e => patch({pcol: e.target.value as keyof typeof PCOL})}>{Object.entries(PCOL).map(([rarity, value]) => <option key={rarity} value={rarity}>{rarity} · {value}%</option>)}</select></label>)}
            {layer('perkOn', '50/50 trade-off perk', 'Enemy damage −50%, tower damage −50%. Improve Trade-Off Perks increases enemy reduction to 55% at lab level 10.', percentInput('Trade-off lab level (0–10)', 'perkLevel', 10))}
            {layer('cfOn', 'Chrono Field', 'Damage reduction research while Chrono Field is active. This is not its enemy slow percentage.', percentInput('CF damage reduction %', 'cf', 25))}
          </CardContent></Card>)
  return <main className="min-h-screen bg-linear-to-b from-background to-muted/30 pb-24">
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 space-y-6">
      <div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Damage Calculator</h1><p className="mt-2 text-sm text-muted-foreground">Compare single hits and Wall survival under sustained attacks.</p></div><Button variant="outline" onClick={() => setSettings({ ...DEFAULT_DAMAGE })}>Reset</Button></div>
      <div className="flex gap-2" role="group" aria-label="Calculator mode">
        <Button variant={mode === 'wall' ? 'default' : 'outline'} onClick={() => setMode('wall')}>Wall sustain</Button>
        <Button variant={mode === 'single' ? 'default' : 'outline'} onClick={() => setMode('single')}>Single hit</Button>
      </div>
      {mode === 'wall' ? <>
        <label className="block max-w-lg space-y-2 text-sm"><span>Enemy damage source (shared)</span><select aria-label="Wall enemy damage source" className={`${selectClass} w-full`} value={settings.enemyIncludesPerk ? 'displayed' : 'raw'} onChange={e => patch({ enemyIncludesPerk: e.target.value === 'displayed' })}><option value="displayed">In-game stat — already includes trade-off perk</option><option value="raw">Raw damage — before trade-off perk</option></select></label>
        <WallSimulator damage={settings} reductions={reductions} onEnemyChange={(enemy, enemyUnit) => patch({enemy, enemyUnit})}/>
      </> : <div className="grid gap-6 md:grid-cols-2 items-start">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Health & target damage</CardTitle></CardHeader><CardContent className="space-y-5">
            <AmountInput label="Current available health" value={settings.health} unit={settings.healthUnit} onChange={(health, healthUnit) => patch({health, healthUnit})} />
            <p className="text-sm text-muted-foreground">Enter the health available to absorb this hit, including recovery health if applicable. Perk health penalties must already be included.</p>
            <AmountInput label="Enemy damage (optional)" value={settings.enemy} unit={settings.enemyUnit} onChange={(enemy, enemyUnit) => patch({enemy, enemyUnit})} />
            <label className="block space-y-2 text-sm"><span>Enemy damage source</span><select className={`${selectClass} w-full`} value={settings.enemyIncludesPerk ? 'displayed' : 'raw'} onChange={e => patch({ enemyIncludesPerk: e.target.value === 'displayed' })}><option value="displayed">In-game stat — already includes trade-off perk</option><option value="raw">Raw damage — before trade-off perk</option></select></label>
            <p className="text-xs text-muted-foreground">Units are case-sensitive: 1q = 1,000T; 1Q = 1,000q (10¹⁸). Use the separate unit selector.</p>
          </CardContent></Card>
          {reductions}
        </div>
        <div className="space-y-5 md:sticky md:top-20">
          <Card className="border-primary/20 bg-primary/5"><CardHeader><CardTitle>Single-hit damage limit</CardTitle></CardHeader><CardContent className="space-y-5">
            {!result ? <p role="alert">Check enabled values: Defense 0–98%, Flame Bot 0–95%, CF 0–25%, trade-off lab integer 0–10.</p> : <>
              <div><div className="text-sm text-muted-foreground">Raw enemy damage before trade-off perk</div><div className="text-4xl font-semibold font-mono mt-2 break-all">{validHealth ? fmt(result.rawLimit) : '—'}</div></div>
              <div><div className="text-sm text-muted-foreground">Limit for selected enemy damage source</div><div className="text-2xl font-mono mt-1">{validHealth ? fmt(result.displayedLimit) : '—'}</div></div>
              <p className="text-sm text-muted-foreground">This is the lethal boundary: a hit must be below this limit to survive. Shown values are rounded.</p>
              <div className="border-t pt-4 text-sm space-y-2"><p>Combined reduction (before perk): {Number(((1 - result.mitigation) * 100).toFixed(8))}%</p><p>Combined reduction (including perk): {Number(((1 - result.rawFactor) * 100).toFixed(8))}%</p><p>Effective health multiplier: ×{Number((1 / result.rawFactor).toPrecision(6)).toLocaleString('en-US')}</p></div>
              {!validHealth && <p className="text-sm">Enter a positive health value to calculate your limit.</p>}
            </>}
          </CardContent></Card>
          {result && hasEnemy && <Card><CardHeader><CardTitle>Target hit</CardTitle></CardHeader><CardContent className="space-y-3">
            {result.enemy === null ? <p role="alert">Enter a valid, non-negative enemy damage value.</p> : <><p>Damage reaching health: <strong className="font-mono">{fmt(result.hit)}</strong></p>{validHealth && <><p className={`text-lg font-semibold ${survive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{survive ? 'Survives one hit' : 'Lethal hit'}</p><p>Health remaining: {fmt(Math.max(0, result.health! - result.hit!))}</p><p>Health required: more than {fmt(result.hit)}</p></>}</>}
          </CardContent></Card>}
          {result && <Card><CardHeader><CardTitle>How it stacks</CardTitle></CardHeader><CardContent className="text-sm space-y-3">
            <p>Reductions multiply the remaining damage; their percentages are not added.</p>
            {result.layers.map(l => <div key={l.name} className="flex justify-between gap-3"><span>{l.name}</span><span>×{Number((1 - l.reduction / 100).toFixed(6))}</span></div>)}
            {settings.perkOn && <div className="flex justify-between gap-3"><span>Trade-off perk ({result.perk}%)</span><span>×{Number((1 - result.perk / 100).toFixed(6))}</span></div>}
            <p className="border-t pt-3 font-mono break-words">Raw limit = health ÷ {Number(result.rawFactor.toPrecision(8))}</p>
            {settings.enemyIncludesPerk && settings.perkOn && <p>The selected enemy stat already includes the perk, so the target hit does not apply it a second time.</p>}
          </CardContent></Card>}
          <p className="text-xs text-muted-foreground leading-relaxed">Models one ordinary hit with every checked effect active on that hit. It does not predict a wave or sustained farming survival. Defense Absolute, Wall mechanics, Chain Thunder, Bot Bot, enemy attack multipliers, repeated-hit scaling and special attacks are not included in this version.</p>
        </div>
      </div>}
      <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">Mechanic references</summary><div className="mt-3 flex flex-wrap gap-4 underline"><a href="https://www.techtreegames.com/post/v28-3-patch-notes" target="_blank" rel="noreferrer">PCol updated values</a><a href="https://the-tower-idle-tower-defense.fandom.com/wiki/Flame_Bot" target="_blank" rel="noreferrer">Flame Bot</a><a href="https://the-tower-idle-tower-defense.fandom.com/wiki/Defense_Percent" target="_blank" rel="noreferrer">Defense %</a><a href="https://the-tower-idle-tower-defense.fandom.com/wiki/Perks" target="_blank" rel="noreferrer">Perks</a><a href="https://the-tower-idle-tower-defense.fandom.com/wiki/Chrono_Field" target="_blank" rel="noreferrer">Chrono Field</a></div></details>
    </div>
  </main>
}
