"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AmountVisibilityToggle } from "@/components/amount-visibility"
import { Button } from "@/components/ui/button"
import { Calendar } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-2">
           {/* Breadcrumbs could go here */}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1">
            <Calendar className="h-4 w-4" />
            <span>Este año</span>
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <AmountVisibilityToggle />
        </div>
      </div>
    </header>
  )
}
