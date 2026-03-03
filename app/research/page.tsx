"use client"

import { useEffect, useMemo, useState } from "react"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Slot = {
  multiplier: number;
  days: string;
  hours: string;
  minutes: string;
}

function pad2(n: number){
  return String(n).padStart(2, "0");
}

function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`
}

function calcMs(slot: Slot) {
  const d = Number(slot.days) || 0;
  const h = Number(slot.hours) || 0;
  const m = Number(slot.minutes) || 0;

  const baseMs = (((d * 24 + h) * 60) + m) * 60 * 1000;

  const mult = slot.multiplier > 0 ? slot.multiplier : 1;
  return baseMs / mult;
}

function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / 60000);

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if(days > 0) parts.push(`${days}d`);
  if(hours > 0) parts.push(`${hours}h`);
  if(minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(" ");
}

export default function MultiPage() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  const [slots, setSlots] = useState<Slot[]>(
    Array.from({length: 5}, () => ({
      multiplier: 1,
      days: "0",
      hours: "0",
      minutes: "0",
    }))
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const results = useMemo(() => {
    return slots.map((slot) => new Date(now.getTime() + calcMs(slot)));
  }, [now, slots])

  function updateSlot(i: number, patch: Partial<Slot>){
    setSlots((prev) => prev.map((s, idx) => (idx === i ? {...s, ...patch} : s)))
  }

  return(
    <main className="min-h-screen bg-linear-to-b from-background to-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Multi Slots</h1>
            <p className="text-sm text-muted-foreground">Each slot: result = now + (duration ÷ multiplier)</p>
          </div>

          <div className="text-right">
            <div className="text-xs text-muted-foreground">Current Time</div>
            <div className="text-xl font-mono tabular-nums">{mounted ? formatTime(now) : "--:--:--"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {slots.map((slot, i) => (
            <Card
              key={i}
              className="rounded-2xl border-muted/60 shadow-sm transition hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold tracking-tight">Slot {i + 1}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[1,2,3,4,5].map((x) => (
                    <Button
                      key={x}
                      type="button"
                      variant={slot.multiplier === x ? "default" : "outline"}
                      className="h-9 px-3"
                      onClick={() => updateSlot(i, {multiplier: x})}
                    >
                      x{x}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Days</div>
                    <Input
                      className="h-10"
                      type="number"
                      min={0}
                      value={slot.days}
                      onChange={(e) => updateSlot(i, {days: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Hours</div>
                    <Input
                      className="h-10"
                      type="number"
                      min={0}
                      value={slot.hours}
                      onChange={(e) => updateSlot(i, {hours: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Minutes</div>
                    <Input
                      className="h-10"
                      type="number"
                      min={0}
                      value={slot.minutes}
                      onChange={(e) => updateSlot(i, {minutes: e.target.value})}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Result</div>
                  <div className="text-lg font-mono tabular-nums">
                    {mounted ? formatTime(results[i]) : "--:--:--"}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {mounted ? formatDate(results[i]) : "---- -- --"}
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    Time needed: {formatDuration(calcMs(slot))}
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