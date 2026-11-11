"use client";

import { Info } from "lucide-react";
import { Tooltip } from "radix-ui";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * An explanation kept out of the way: a small "i" that shows it on hover
 * or focus, and on a tap where there is no hover. What it says is worth
 * reading once, so it does not take a line of the screen all the time.
 */
export function InfoTip({ label, children, side = "bottom", align = "start", className }: { label: string; children: ReactNode; side?: "top" | "bottom" | "left" | "right"; align?: "start" | "center" | "end"; className?: string }) {
  const [open, setOpen] = useState(false);
  // A press closes a tooltip before the click arrives; this remembers what the press found.
  const wasOpen = useRef(false);
  return (
    <Tooltip.Provider delayDuration={120} skipDelayDuration={300}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            onPointerDown={() => (wasOpen.current = open)}
            onClick={() => setOpen(!wasOpen.current)}
            className={cn("press grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground data-[state=delayed-open]:text-foreground data-[state=instant-open]:text-foreground", className)}
          >
            <Info className="size-3.5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            align={align}
            sideOffset={8}
            collisionPadding={12}
            className="glass z-50 flex max-w-[19rem] origin-(--radix-tooltip-content-transform-origin) animate-in flex-col gap-2 rounded-xl border border-border p-3 text-xs leading-relaxed text-foreground shadow-[var(--shadow-float)] duration-200 fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {children}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
