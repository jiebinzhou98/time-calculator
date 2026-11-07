"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Slot = {
  multiplier: number
  days: string
  hours: string
  minutes: string
  remainingMs?: number
  updatedAt?: number
}

const STORAGE_KEY = "time-calculator-research-slots"

function createDefaultSlots(): Slot[] {
  return Array.from({ length: 5 }, () => ({
    multiplier: 1,
    days: "0",
    hours: "0",
    minutes: "0",
  }))
}

function normalizeSlot(slot: Partial<Slot> | undefined): Slot {
  return {
    multiplier: Number(slot?.multiplier) > 0 ? Number(slot?.multiplier) : 1,
    days: String(slot?.days ?? "0"),
    hours: String(slot?.hours ?? "0"),
    minutes: String(slot?.minutes ?? "0"),
    remainingMs: Number.isFinite(slot?.remainingMs) ? Math.max(0, slot!.remainingMs!) : undefined,
    updatedAt: Number.isFinite(slot?.updatedAt) ? slot!.updatedAt : undefined,
  }
}

function normalizeSlots(data: unknown): Slot[] {
  if (!Array.isArray(data)) {
    return createDefaultSlots()
  }

  return Array.from({ length: 5 }, (_, index) =>
    normalizeSlot(data[index] as Partial<Slot> | undefined)
  )
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function formatDate(d: Date) {
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  return `${y}-${m}-${day}`
}

function remainingMs(slot: Slot, now: number) {
  const initial = slot.remainingMs ?? (
    ((Math.max(0, Number(slot.days) || 0) * 24 + Math.max(0, Number(slot.hours) || 0)) * 60
      + Math.max(0, Number(slot.minutes) || 0)) * 60000
  )
  const elapsed = Math.max(0, now - (slot.updatedAt ?? now))
  return Math.max(0, initial - elapsed * slot.multiplier)
}

function timeParts(ms: number) {
  const minutes = Math.ceil(ms / 60000)
  return {
    days: String(Math.floor(minutes / 1440)),
    hours: String(Math.floor(minutes % 1440 / 60)),
    minutes: String(minutes % 60),
  }
}

function formatDuration(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000)
  const totalMinutes = Math.floor(totalSeconds / 60)

  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []

  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)

  parts.push(`${totalSeconds % 60}s`)
  return parts.join(" ")
}

export default function MultiPage() {
  const [editing, setEditing] = useState<{ index: number; field: string; value: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [now, setNow] = useState<Date>(() => new Date())
  const [slots, setSlots] = useState<Slot[]>(() => createDefaultSlots())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)

      if (saved) {
        const parsed = JSON.parse(saved)
        const timestamp = Date.now()
        setSlots(normalizeSlots(parsed).map(slot => ({
          ...slot,
          remainingMs: remainingMs(slot, timestamp),
          updatedAt: timestamp,
        })))
      } else {
        setSlots(createDefaultSlots())
      }
    } catch (error) {
      console.error("Failed to load slots:", error)
      setSlots(createDefaultSlots())
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slots))
    } catch (error) {
      console.error("Failed to save slots:", error)
    }
  }, [slots, hydrated])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const results = useMemo(() => {
    return slots.map((slot) => new Date(now.getTime() + remainingMs(slot, now.getTime()) / slot.multiplier))
  }, [now, slots])

  function updateSlot(i: number, patch: Partial<Slot>) {
    const timestamp = Date.now()
    setNow(new Date(timestamp))
    setSlots(prev => prev.map((slot, index) => {
      if (index !== i) return slot
      const remaining = remainingMs(slot, timestamp)
      const parts = { ...timeParts(remaining), ...patch }
      const changesTime = patch.days !== undefined || patch.hours !== undefined || patch.minutes !== undefined
      return {
        ...slot,
        ...patch,
        remainingMs: changesTime
          ? ((Math.max(0, Number(parts.days) || 0) * 24 + Math.max(0, Number(parts.hours) || 0)) * 60
            + Math.max(0, Number(parts.minutes) || 0)) * 60000
          : remaining,
        updatedAt: timestamp,
      }
    }))
  }

  function resetSlots() {
    setEditing(null)
    const freshSlots = createDefaultSlots()
    setSlots(freshSlots)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(freshSlots))
    } catch (error) {
      console.error("Failed to reset slots:", error)
    }
  }

  const running = slots.filter(slot => remainingMs(slot, now.getTime()) > 0).length
  return <main className="console-page">
    <div className="console-page-heading"><div><p className="console-eyebrow">RESEARCH WORKSPACE</p><h1>Lab timers</h1><p className="console-subtitle">Five slots. Live progress. Your next upgrade, on time.</p></div><Button variant="outline" onClick={resetSlots} className="text-xs">Reset all</Button></div>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-border pb-4"><p className="text-xs text-muted-foreground"><span className="console-dot"/>{running} / 5 labs running</p><p className="text-xs text-muted-foreground">Local time <span className="font-mono text-foreground ml-3" suppressHydrationWarning>{mounted?formatTime(now):'--:--:--'}</span></p></div>
    <div className="console-lab-grid">
      {slots.map((slot,i)=>{
        const left=remainingMs(slot,now.getTime())
        const parts=timeParts(left)
        return <Card key={i} className="console-lab-card">
          <CardHeader><CardTitle className="flex items-center justify-between text-sm"><span><span className="text-muted-foreground font-mono text-xs mr-3">{pad2(i+1)}</span>Lab {i+1}</span><span className={left>0?'text-primary text-[10px] font-normal':'text-muted-foreground text-[10px] font-normal'}>{left>0?'● Running':(Number(slot.days)>0||Number(slot.hours)>0||Number(slot.minutes)>0||Number(slot.remainingMs)>0)?'Complete':'Ready'}</span></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="console-lab-rate">{[1,2,3,4,5].map(x=><Button key={x} variant={slot.multiplier===x?'default':'outline'} onClick={()=>updateSlot(i,{multiplier:x})} aria-label={`Lab ${i+1} speed ${x}x`} aria-pressed={slot.multiplier===x}>{x}×</Button>)}</div>
            <div className="lab-fields">{(['days','hours','minutes'] as const).map(field=><label key={field}><span className="console-field-label capitalize">{field}</span><Input type="number" min={0} inputMode="numeric" aria-label={`Lab ${i+1} ${field}`} value={editing?.index===i&&editing.field===field?editing.value:parts[field]} onFocus={e=>setEditing({index:i,field,value:e.target.value})} onBlur={()=>setEditing(null)} onChange={e=>{setEditing({index:i,field,value:e.target.value});updateSlot(i,{[field]:e.target.value})}}/></label>)}</div>
            <div className="rounded-lg bg-background px-4 py-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Research remaining</p><p className="font-mono text-lg mt-1 tabular-nums" suppressHydrationWarning>{mounted?formatDuration(left):'—'}</p></div>
            <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] text-muted-foreground mb-1">Estimated completion</p><p className="font-mono text-primary text-xl tabular-nums" suppressHydrationWarning>{mounted&&left>0?formatTime(results[i]):'—'}</p><p className="text-[10px] text-muted-foreground mt-1" suppressHydrationWarning>{mounted&&left>0?formatDate(results[i]):'Enter remaining research time'}</p></div><div className="text-right"><p className="text-[10px] text-muted-foreground mb-1">Real time left</p><p className="text-xs font-mono" suppressHydrationWarning>{mounted?formatDuration(left/slot.multiplier):'—'}</p></div></div>
          </CardContent>
        </Card>
      })}
    </div>
    <p className="console-footer-note">Progress follows elapsed time, even when this page is closed.</p>
  </main>
}
