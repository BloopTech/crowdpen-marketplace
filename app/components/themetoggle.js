"use client";
import React, { useState, useEffect } from "react";
import { Monitor, Moon, Sun, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSubMenu,
  DropdownMenuSubMenuTrigger,
  DropdownMenuSubMenuContent,
} from "./ui/dropdown-menu";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <DropdownMenuSubMenu>
        <DropdownMenuSubMenuTrigger>
          <span className="font-poynterroman font-semibold">Theme</span>
        </DropdownMenuSubMenuTrigger>

        <DropdownMenuSubMenuContent>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <span className="flex w-full items-center gap-2 cursor-pointer font-poynterroman py-1.5 pl-2 pr-1">
              <Sun className="size-4 text-inherit" />
              <span>Light</span>
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <span className="flex w-full items-center gap-2 cursor-pointer font-poynterroman py-1.5 pl-2 pr-1">
              <Moon className="size-4 text-inherit" />
              <span>Dark</span>
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("system")}>
            <span className="flex w-full items-center gap-2 cursor-pointer font-poynterroman py-1.5 pl-2 pr-1">
              <Monitor className="size-4 text-inherit" />
              <span>System</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuSubMenuContent>
      </DropdownMenuSubMenu>
    </>
  );
}
