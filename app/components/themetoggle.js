"use client";
import React, { useState, useEffect } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Monitor, Moon, Sun, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);

  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex w-full font-poynterroman">
      <Menu>
        <MenuButton
          className= {`hover:bg-black hover:text-white text-gray-900 dark:text-white dark:hover:bg-white dark:hover:text-black group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold justify-between cursor-pointer`}
          data-hover="true"
        >
          Theme
          <ChevronRight className="size-4" aria-hidden="true" />
        </MenuButton>

        <MenuItems
          transition
          anchor="right"
          className="w-52 origin-top-right rounded-xl border border-slate-300 bg-white dark:bg-[#1a1a1a] dark:text-white p-1 text-sm/6 text-black transition duration-100 ease-out [--anchor-gap:var(--spacing-1)] focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0 group z-20"
        >
          <MenuItem>
            <button
              className="group hover:bg-black hover:text-white dark:hover:bg-[#f2f2f2] dark:hover:text-black flex w-full items-center gap-2 py-1.5 px-3 cursor-pointer"
              onClick={() => setTheme("light")}
            >
              <Sun className="size-4" />
              Light
            </button>
          </MenuItem>
          <MenuItem>
            <button
              className="group hover:bg-black hover:text-white flex w-full items-center gap-2 py-1.5 px-3 dark:hover:bg-[#f2f2f2] dark:hover:text-black cursor-pointer"
              onClick={() => setTheme("dark")}
            >
              <Moon className="size-4" />
              Dark
            </button>
          </MenuItem>
          <MenuItem>
            <button
              className="group hover:bg-black hover:text-white flex w-full items-center gap-2 py-1.5 px-3 dark:hover:bg-[#f2f2f2] dark:hover:text-black cursor-pointer"
              onClick={() => setTheme("system")}
            >
              <Monitor className="size-4" />
              System
            </button>
          </MenuItem>
        </MenuItems>
      </Menu>
    </div>
  );
}
