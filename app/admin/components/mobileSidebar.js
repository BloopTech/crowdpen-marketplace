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
            data-testid="admin-mobile-sidebar-trigger"
          >
            <Menu className="size-6 shrink-0 sm:size-5" aria-hidden="true" />
          </button>
        </DrawerTrigger>
        <DrawerContent
          className="sm:max-w-lg"
          data-testid="admin-mobile-sidebar-content"
        >
          <DrawerBody data-testid="admin-mobile-sidebar-body">
            <nav
              aria-label="core navigation links"
              className="flex flex-1 flex-col space-y-5 px-4"
              data-testid="admin-mobile-sidebar-nav"
            >
              {navigation
                ?.filter((item) => item && item.id !== null)
                .map(({ label, items, id }) => {
                  return (
                    <div
                      key={id}
                      className="flex flex-col space-y-3"
                      data-testid={`admin-mobile-sidebar-section-${String(id).toLowerCase()}`}
                    >
                      <span
                        className="text-xs text-muted-foreground"
                        data-testid={`admin-mobile-sidebar-section-label-${String(id).toLowerCase()}`}
                      >
                        {label}
                      </span>
                      <ul
                        role="list"
                        className="space-y-1"
                        data-testid={`admin-mobile-sidebar-section-list-${String(id).toLowerCase()}`}
                      >
                        {items.map(
                          ({ name, href, icon: Icon, other_items }, index) => {
                            const hasDropdown =
                              other_items && other_items.length > 0;
                            const isDropdownOpen = openDropdowns[name] || false;
                            const itemSlug = String(name || "")
                              .toLowerCase()
                              .replace(/\s+/g, "-");

                            return (
                              <li
                                key={name}
                                className="flex flex-col"
                                data-testid={`admin-mobile-sidebar-item-${itemSlug}`}
                              >
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
                                    data-testid={`admin-mobile-sidebar-item-toggle-${itemSlug}`}
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
                                        data-testid={`admin-mobile-sidebar-item-icon-${itemSlug}`}
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
                                      data-testid={`admin-mobile-sidebar-item-chevron-${itemSlug}`}
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
                                    data-testid={`admin-mobile-sidebar-item-link-${itemSlug}`}
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
                                      data-testid={`admin-mobile-sidebar-item-icon-${itemSlug}`}
                                    />
                                    {name}
                                  </Link>
                                )}

                                {/* Dropdown items */}
                                {hasDropdown && isDropdownOpen && (
                                  <ul
                                    className="ml-6 mt-1 space-y-1"
                                    data-testid={`admin-mobile-sidebar-sublist-${itemSlug}`}
                                  >
                                    {other_items.map((subItem) => {
                                      const subSlug = String(subItem.name || "")
                                        .toLowerCase()
                                        .replace(/\s+/g, "-");
                                      return (
                                        <li
                                          key={subItem.name}
                                          data-testid={`admin-mobile-sidebar-subitem-${itemSlug}-${subSlug}`}
                                        >
                                          <Link
                                            href={subItem.href}
                                            className={cn(
                                              isActive(subItem.href)
                                                ? "bg-tertiary text-foreground dark:text-background border border-tertiary hover:bg-tertiary/90"
                                                : "text-foreground",
                                              "flex items-center text-xs py-1.5 transition hover:bg-accent hover:text-accent-foreground font-medium group pl-4",
                                              focusRing
                                            )}
                                            data-testid={`admin-mobile-sidebar-subitem-link-${itemSlug}-${subSlug}`}
                                          >
                                            {subItem.name}
                                          </Link>
                                        </li>
                                      );
                                    })}
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
