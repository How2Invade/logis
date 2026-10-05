"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

export function ModeToggle({ collapsed }: { collapsed?: boolean }) {
  const [mounted, setMounted] = React.useState(false)
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-16 h-8 shrink-0" />
  }

  const isDark = theme === "dark"

  if (collapsed) {
    return (
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-surface-2 border border-border transition-colors shrink-0 hover:bg-surface"
        aria-label="Toggle theme"
      >
        {isDark ? (
          <Moon className="w-4 h-4 text-foreground" />
        ) : (
          <Sun className="w-4 h-4 text-foreground" />
        )}
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center w-16 h-8 rounded-full bg-surface-2 p-1 border border-border transition-colors relative shrink-0"
      aria-label="Toggle theme"
    >
      <div
        className={cn(
          "absolute left-1 top-1 w-6 h-6 rounded-full bg-dark-action flex items-center justify-center transition-all duration-300",
          isDark ? "translate-x-8" : "translate-x-0"
        )}
      >
        {isDark ? (
          <Moon className="w-3 h-3 text-dark-action-fg" />
        ) : (
          <Sun className="w-3 h-3 text-dark-action-fg" />
        )}
      </div>
      <div className="flex items-center justify-between w-full px-1.5 text-muted-foreground z-0">
        <Sun className="w-3.5 h-3.5 opacity-50" />
        <Moon className="w-3.5 h-3.5 opacity-50" />
      </div>
    </button>
  )
}
