"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "../../../public/crowdpen_icon.png";
import { useRouter, usePathname } from "next/navigation";
import { cn, focusRing } from "../../lib/utils";
import { useNavigationData } from "./utils";
import MobileSidebar from "./mobileSidebar";
import ProfileImage from "./profileimage";
import { ChevronDown } from "lucide-react";

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [openDropdowns, setOpenDropdowns] = useState({});
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
      {/* sidebar (lg+) */}
      <nav className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-62 lg:flex-col mt-1">
        <aside className="flex grow flex-col xl:gap-y-8 gap-y-5 overflow-y-auto border-r border-border bg-card">
          <div className="pl-[1rem]">
            <Link href="/">
              <Image
                alt="logo"
                src={logo}
                width={30}
                height={30}
                priority
                className="logo-image dark:invert"
              />
            </Link>
          </div>

          <nav
            aria-label="core navigation links"
            className="flex flex-1 flex-col space-y-3"
          >
            {navigation
              ?.filter((item) => item && item.id !== null)
              .map(({ label, items, id }) => {
                return (
                  <div key={id} className="flex flex-col space-y-1">
                    <span className="text-xs text-muted-foreground pl-[4rem]">
                      {label}
                    </span>

                    <ul role="list" className="w-full">
                      {items?.map(
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
                                  <div className="flex items-center gap-x-8">
                                    <span className="flex items-center justify-between pl-[1rem]">
                                      <Icon
                                        aria-hidden="true"
                                        className={cn(
                                          isActive(href)
                                            ? "text-foreground dark:text-background"
                                            : "text-muted-foreground group-hover:text-accent-foreground",
                                          "size-4 shrink-0",
                                          focusRing
                                        )}
                                      />
                                    </span>
                                    {name}
                                  </div>
                                  <ChevronDown
                                    className={cn(
                                      "size-4 mr-4 transition-transform",
                                      isDropdownOpen ? "rotate-180" : "rotate-0"
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
                                  <span className="flex items-center justify-between pl-[1rem]">
                                    <Icon
                                      aria-hidden="true"
                                      className={cn(
                                        isActive(href)
                                          ? "text-foreground dark:text-background"
                                          : "text-muted-foreground group-hover:text-accent-foreground",
                                        "size-4 shrink-0",
                                        focusRing
                                      )}
                                    />
                                  </span>
                                  {name}
                                </Link>
                              )}

                              {/* Dropdown items */}
                              {hasDropdown && isDropdownOpen && (
                                <ul className="ml-12 mt-1 space-y-1">
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
        </aside>
      </nav>
      {/* top navbar (xs-lg) */}
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-2 shadow-sm sm:gap-x-6 sm:px-4 lg:hidden">
        <div>
          <Link href="/">
            <Image
              alt="logo"
              src={logo}
              width={125}
              height={64}
              priority
              className="logo-image dark:invert"
            />
          </Link>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <ProfileImage />
          <MobileSidebar />
        </div>
      </div>
    </>
  );
}
