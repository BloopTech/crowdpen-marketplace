"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./dropdown-menu";
import { LogOut, User } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/tooltipper";
import { useTheme } from "next-themes";
import UserProfilePicture from "../userpfp";
import ThemeToggle from "../themetoggle";

export function UserId() {
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger className="relative inline-block text-left outline-none">
          <div className="mt-1">
            <div className="relative">
              <UserProfilePicture
                rounded="rounded-full"
                image={session?.user?.image}
                name={session?.user?.name}
                color={session?.user?.color}
                imageWidth={24}
                imageHeight={24}
                avatarCircle={100}
                avatarHeight={24}
                avatarWidth={24}
                avatarSize={10}
                width={6}
                height={6}
              />
              {/* {(session?.user?.subscribed || session?.user?.crowdpen_staff) && (
                <div className="absolute top-0 right-0 -mr-1 -mt-1">
                  <Tooltip placement="bottom">
                    <TooltipTrigger>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#d3a155]"></span>
                    </TooltipTrigger>
                    <TooltipContent>
                      You&apos;re now on the plus membership 🎉
                    </TooltipContent>
                  </Tooltip>
                </div>
              )} */}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="z-20 overflow-y-auto bg-white w-56">
          <DropdownMenuItem>
            <Link href="/account" className="w-full">
              <div
                className={`hover:bg-black hover:text-white text-gray-900 dark:text-white dark:hover:bg-white dark:hover:text-black group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
              >
                <User className="mr-2 h-5 w-5" aria-hidden="true" />
                Account
              </div>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem>
            <ThemeToggle />
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => signOut()}>
            <div
              className={`hover:bg-black hover:text-white text-gray-900 dark:text-white dark:hover:bg-white dark:hover:text-black group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
            >
              <LogOut className="mr-2 h-5 w-5" aria-hidden="true" />
              Logout
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
