'use client'

import Link from "next/link"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Time Calculator</h1>
          <p className="text-sm text-muted-foreground">Choose a mode below</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-muted/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight">
                Single Calculator
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Live current time + duration → result time</p>
              <Button asChild className="w-full">
                <Link href="/daily">Open</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight">
                Multi Slots
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                5 slots with multipliers and results
              </p>
              <Button asChild className="w-full" variant="outline">
                <Link href="/research">Open</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
