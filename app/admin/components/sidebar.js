"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "../../../public/crowdpen_icon.png";
import { useRouter } from "next/navigation";
import { cn, focusRing } from "../../lib/utils";
import { useNavigationData } from "./utils";
import MobileSidebar from "./mobileSidebar";
import ProfileImage from "./profileimage";
import { ChevronDown } from "lucide-react";

export default function AdminSidebar() {
  const router = useRouter();
  const { pathname } = router;
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
        <aside className="flex grow flex-col xl:gap-y-8 gap-y-5 overflow-y-auto border-r border-gray-300">
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
                    <span className="text-xs text-black dark:text-white pl-[4rem]">
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
                                      ? "text-white bg-[#d3a155] dark:text-white border border-[#d3a155] hover:text-[#d3a155] hover:!bg-white hover:dark:text-white"
                                      : "text-black dark:text-white hover:dark:text-gray-50",
                                    "flex items-center justify-between text-xs py-1.5 transition hover:bg-tertiary hover:dark:bg-gray-900 font-medium group w-full",
                                    focusRing
                                  )}
                                >
                                  <div className="flex items-center gap-x-8">
                                    <span className="flex items-center justify-between pl-[1rem]">
                                      <Icon
                                        aria-hidden="true"
                                        className={cn(
                                          isActive(href)
                                            ? " dark:text-white group-hover:text-[#d3a155] dark:group-hover:text-white"
                                            : "text-black dark:text-white hover:dark:text-gray-50",
                                          "size-4 shrink-0 text-black flex items-center justify-center",
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
                                      ? "!text-white bg-[#d3a155] dark:text-white border border-[#d3a155] hover:!text-[#d3a155] hover:!bg-white hover:dark:text-white"
                                      : "text-black hover:!text-white dark:text-white hover:dark:text-gray-50",
                                    "flex items-center gap-x-8 text-xs py-1.5 transition hover:bg-[#d3a155] hover:dark:bg-gray-900 font-medium group",
                                    focusRing
                                  )}
                                >
                                  <span className="flex items-center justify-between pl-[1rem]">
                                    <Icon
                                      aria-hidden="true"
                                      className={cn(
                                        isActive(href)
                                          ? "!text-white group-hover:!text-[#d3a155] dark:group-hover:!text-white"
                                          : "text-black group-hover:text-white dark:text-white hover:dark:text-gray-50",
                                        "size-4 shrink-0 text-black flex items-center justify-center",
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
                                            ? "!text-white bg-[#d3a155] dark:text-white border border-[#d3a155] hover:!text-[#d3a155] hover:!bg-white hover:dark:text-white"
                                            : "text-black hover:!text-white dark:text-white hover:dark:text-gray-50",
                                          "flex items-center text-xs py-1.5 transition hover:bg-[#d3a155] hover:dark:bg-gray-900 font-medium group pl-4",
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
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-2 shadow-sm sm:gap-x-6 sm:px-4 lg:hidden dark:border-gray-800 dark:bg-gray-950">
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
