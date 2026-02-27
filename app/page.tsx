"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Duration = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatDate(d: Date) {
  //local time
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y} - ${m} - ${day}`;
}

export default function Home() {
  //current time with second, base Now
  const [now, setNow] = useState<Date>(() => new Date());

  //time duration
  const [duration, setDuration] = useState<Duration>({
    days: "0",
    hours: "0",
    minutes: "0",
    seconds: "0",
  })

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const result = useMemo(() => {
    const days = Number(duration.days) || 0;
    const hours = Number(duration.hours) || 0;
    const minutes = Number(duration.minutes) || 0;
    const seconds = Number(duration.seconds) || 0;

    const ms = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
    return new Date(now.getTime() + ms);
  }, [now, duration]);

  return (
    <main className="min-h-screen bg-linear-to-b from-background to-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <div className="space-y-6">
          <Card className="rounded-2xl border-muted/60 shadow-sm transition hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight">Current Time</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-5xl md:text-6xl font-semibold tracking-tight tabular-nums font-mono">
                {formatTime(now)}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 shadow-sm transition hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight">Duration</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Days</div>
                <Input
                  className="h-11"
                  type="number"
                  min={0}
                  value={duration.days}
                  onChange={(e) => setDuration((d) => ({
                    ...d, days: e.target.value
                  }))}
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Hours</div>
                <Input
                  className="h-11"
                  type="number"
                  min={0}
                  value={duration.hours}
                  onChange={(e) => setDuration((d) => ({
                    ...d, hours: e.target.value
                  }))}
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Minutes</div>
                <Input
                  className="h-11"
                  type="number"
                  min={0}
                  value={duration.minutes}
                  onChange={(e) => setDuration((d) => ({
                    ...d, minutes: e.target.value
                  }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-sm transition hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight">Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-5xl md:text-6xl font-semibold tracking-tight tabular-nums font-mono">
                {formatTime(result)}
              </div>
              <div className="text-sm text-muted-foreground tabular-nums">
                {formatDate(result)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}