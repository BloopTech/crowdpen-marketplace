"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../../components/ui/drawer";
import { cn, focusRing } from "../../lib/utils";
import { useNavigationData } from "./utils";
import { Menu, ChevronDown } from "lucide-react";

export default function MobileSidebar() {
  const [openDropdowns, setOpenDropdowns] = useState({});
  const router = useRouter();
  const { pathname } = router;
  const navigation = useNavigationData();

  const isActive = (itemHref) => {
    if (itemHref === "/") {
      return pathname.startsWith("/settings");
    }
    return pathname === itemHref;
  };

  const toggleDropdown = (itemName) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [itemName]: !prev[itemName],
    }));
  };

  return (
    <>
      <Drawer>
        <DrawerTrigger asChild>
          <button
            //variant="ghost"
            aria-label="open sidebar"
            className="cursor-pointer group text-foreground flex items-center rounded-md p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent"
          >
            <Menu className="size-6 shrink-0 sm:size-5" aria-hidden="true" />
          </button>
        </DrawerTrigger>
        <DrawerContent className="sm:max-w-lg">
          <DrawerBody>
            <nav
              aria-label="core navigation links"
              className="flex flex-1 flex-col space-y-5 px-4"
            >
              {navigation
                ?.filter((item) => item && item.id !== null)
                .map(({ label, items, id }) => {
                  return (
                    <div key={id} className="flex flex-col space-y-3">
                      <span className="text-xs text-muted-foreground">
                        {label}
                      </span>
                      <ul role="list" className="space-y-1">
                        {items.map(
                          ({ name, href, icon: Icon, other_items }, index) => {
                            const hasDropdown =
                              other_items && other_items.length > 0;
                            const isDropdownOpen = openDropdowns[name] || false;

                            return (
                              <li key={name} className="flex flex-col">
                                {hasDropdown ? (
                                  <button
                                    onClick={() => toggleDropdown(name)}
                                    className={cn(
                                      isActive(href)
                                        ? "bg-tertiary text-foreground dark:text-background border border-tertiary hover:bg-tertiary/90"
                                        : "text-foreground",
                                      "flex items-center justify-between text-xs py-1.5 transition hover:bg-accent hover:text-accent-foreground font-medium group w-full",
                                      focusRing
                                    )}
                                  >
                                    <div className="flex items-center gap-x-2.5">
                                      <Icon
                                        className={cn(
                                          isActive(href)
                                            ? "text-foreground dark:text-background"
                                            : "text-muted-foreground group-hover:text-accent-foreground",
                                          "size-4 shrink-0",
                                          focusRing
                                        )}
                                        aria-hidden="true"
                                      />
                                      {name}
                                    </div>
                                    <ChevronDown
                                      className={cn(
                                        "size-4 transition-transform",
                                        isDropdownOpen
                                          ? "rotate-180"
                                          : "rotate-0"
                                      )}
                                    />
                                  </button>
                                ) : (
                                  <Link
                                    href={href}
                                    className={cn(
                                      isActive(href)
                                        ? "bg-tertiary text-foreground dark:text-background border border-tertiary hover:bg-tertiary/90"
                                        : "text-foreground",
                                      "flex items-center gap-x-8 text-xs py-1.5 transition hover:bg-accent hover:text-accent-foreground font-medium group",
                                      focusRing
                                    )}
                                  >
                                    <Icon
                                      className={cn(
                                        isActive(href)
                                          ? "text-foreground dark:text-background"
                                          : "text-muted-foreground group-hover:text-accent-foreground",
                                        "size-4 shrink-0",
                                        focusRing
                                      )}
                                      aria-hidden="true"
                                    />
                                    {name}
                                  </Link>
                                )}

                                {/* Dropdown items */}
                                {hasDropdown && isDropdownOpen && (
                                  <ul className="ml-6 mt-1 space-y-1">
                                    {other_items.map((subItem) => (
                                      <li key={subItem.name}>
                                        <Link
                                          href={subItem.href}
                                          className={cn(
                                            isActive(subItem.href)
                                              ? "bg-tertiary text-foreground dark:text-background border border-tertiary hover:bg-tertiary/90"
                                              : "text-foreground",
                                            "flex items-center text-xs py-1.5 transition hover:bg-accent hover:text-accent-foreground font-medium group pl-4",
                                            focusRing
                                          )}
                                        >
                                          {subItem.name}
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            );
                          }
                        )}
                      </ul>
                    </div>
                  );
                })}
            </nav>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
