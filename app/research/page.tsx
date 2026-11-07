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

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-24">
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 md:px-8 md:py-10 space-y-5 md:space-y-6">
        <div className="flex items-end justify-between gap-3 md:gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
              Lab Slots
            </h1>
          </div>

          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" onClick={resetSlots}>
              Reset
            </Button>

            <div className="text-right">
              <div className="text-[10px] text-muted-foreground sm:text-xs">
                Current Time
              </div>
              <div className="text-base font-mono tabular-nums sm:text-lg md:text-2xl">
                {mounted ? formatTime(now) : "--:--:--"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:gap-6">
          {slots.map((slot, i) => (
            <Card
              key={i}
              className="w-full rounded-2xl border-muted/60 shadow-sm transition hover:shadow-md md:rounded-3xl"
            >
              <CardHeader className="pb-2 md:pb-3">
                <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">
                  Slot {i + 1}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                  {[1, 2, 3, 4, 5].map((x) => (
                    <Button
                      key={x}
                      type="button"
                      variant={slot.multiplier === x ? "default" : "outline"}
                      className="h-11 w-full px-0 text-lg font-semibold sm:h-12 sm:text-xl md:h-16 md:text-2xl"
                      onClick={() => updateSlot(i, { multiplier: x })}
                    >
                      x{x}
                    </Button>
                  ))}
                </div>

                <div className="text-sm text-muted-foreground" aria-live="off">
                  Research remaining: {formatDuration(remainingMs(slot, now.getTime()))}
                </div>

                <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                  <div className="space-y-1.5 md:space-y-2">
                    <div className="text-lg font-medium text-muted-foreground sm:text-xl md:text-2xl">
                      Days
                    </div>
                    <Input
                      className="h-14 text-2xl sm:h-16 sm:text-3xl md:h-20 md:text-4xl"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={editing?.index === i && editing.field === "days" ? editing.value : timeParts(remainingMs(slot, now.getTime())).days}
                      onFocus={(e) => setEditing({ index: i, field: "days", value: e.target.value })}
                      onBlur={() => setEditing(null)}
                      onChange={(e) => {
                        setEditing({ index: i, field: "days", value: e.target.value })
                        updateSlot(i, { days: e.target.value })
                      }}
                    />
                  </div>

                  <div className="space-y-1.5 md:space-y-2">
                    <div className="text-lg font-medium text-muted-foreground sm:text-xl md:text-2xl">
                      Hours
                    </div>
                    <Input
                      className="h-14 text-2xl sm:h-16 sm:text-3xl md:h-20 md:text-4xl"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={editing?.index === i && editing.field === "hours" ? editing.value : timeParts(remainingMs(slot, now.getTime())).hours}
                      onFocus={(e) => setEditing({ index: i, field: "hours", value: e.target.value })}
                      onBlur={() => setEditing(null)}
                      onChange={(e) => {
                        setEditing({ index: i, field: "hours", value: e.target.value })
                        updateSlot(i, { hours: e.target.value })
                      }}
                    />
                  </div>

                  <div className="space-y-1.5 md:space-y-2">
                    <div className="text-lg font-medium text-muted-foreground sm:text-xl md:text-2xl">
                      Minutes
                    </div>
                    <Input
                      className="h-14 text-2xl sm:h-16 sm:text-3xl md:h-20 md:text-4xl"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={editing?.index === i && editing.field === "minutes" ? editing.value : timeParts(remainingMs(slot, now.getTime())).minutes}
                      onFocus={(e) => setEditing({ index: i, field: "minutes", value: e.target.value })}
                      onBlur={() => setEditing(null)}
                      onChange={(e) => {
                        setEditing({ index: i, field: "minutes", value: e.target.value })
                        updateSlot(i, { minutes: e.target.value })
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4 md:rounded-2xl md:p-6">
                  <div className="text-lg text-muted-foreground sm:text-xl md:text-2xl">
                    Completion Time
                  </div>

                  <div className="text-3xl font-mono tabular-nums sm:text-4xl md:text-5xl">
                    {mounted ? (remainingMs(slot, now.getTime()) > 0 ? formatTime(results[i]) : "Completed") : "--:--:--"}
                  </div>

                  <div className="text-lg text-muted-foreground tabular-nums sm:text-xl md:text-2xl">
                    {mounted && remainingMs(slot, now.getTime()) > 0 ? formatDate(results[i]) : "—"}
                  </div>

                  <div className="mt-3 text-lg leading-snug text-muted-foreground sm:text-xl md:mt-4 md:text-2xl">
                    Time needed:{" "}
                    <span className="font-mono text-foreground">
                      {formatDuration(remainingMs(slot, now.getTime()) / slot.multiplier)}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      (x{slot.multiplier} speed)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}