"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "../lib/utils";

export function StatusPill({ icon: Icon, emoji, label, className = "", dataTestId }) {
  if (!Icon && !emoji) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm shadow-black/20",
              className
            )}
            data-testid={dataTestId}
          >
            {Icon ? (
              <Icon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <span aria-hidden="true" className="text-base">
                {emoji}
              </span>
            )}
            <span className="sr-only">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
