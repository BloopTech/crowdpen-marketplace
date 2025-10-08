"use client";
import React, { useState, Fragment, useEffect, useRef } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { LogOut, UserRound, LayoutDashboard } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import ThemeToggle from "../../components/themetoggle";
import { useRouter } from "next/navigation";
import {
  AvatarFallback,
  Avatar,
  AvatarImage,
} from "../../components/ui/avatar";

export default function ProfileImage() {
  const [mounted, setMounted] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const menuRef = useRef(null);
  const { data: session } = useSession();
  const router = useRouter();

  const toggleUserDropdown = () => {
    setUserOpen(!userOpen);
  };

  const closeUserDropdown = () => {
    setUserOpen(false);
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeUserDropdown();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="mt-1">
            <div className="relative">
              <Avatar className="w-8 h-8 ring-4 ring-white shadow-xl">
                <AvatarImage
                  src={session.user.image || "/default-avatar.png"}
                  alt={session.user.name}
                  className="object-cover"
                />
                <AvatarFallback className="text-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  {session.user.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {(session?.user?.subscribed || session?.user?.crowdpen_staff) && (
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
              )}
            </div>
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="bottom"
          align="end"
          className="w-40 bg-white dark:bg-[#1a1a1a] dark:text-white border-slate-300 border shadow-lg z-10 text-gray-900"
        >
          <DropdownMenuItem
            onClick={() => {
              router.push("/");
              closeUserDropdown();
            }}
            className="hover:bg-black hover:text-white text-gray-900 dark:text-white dark:hover:bg-white dark:hover:text-black group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold justify-between cursor-pointer font-poynterroman"
          >
            <LayoutDashboard className="mr-2 h-5 w-5" aria-hidden="true" />
            Dashboard
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              router.push("/creator/profile");
              closeUserDropdown();
            }}
            className="hover:bg-black hover:text-white text-gray-900 dark:text-white dark:hover:bg-white dark:hover:text-black group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold justify-between cursor-pointer font-poynterroman"
          >
            <UserRound className="mr-2 h-5 w-5" aria-hidden="true" />
            Profile
          </DropdownMenuItem>

          <ThemeToggle />

          <DropdownMenuItem
            onClick={() => {
              signOut();
              closeUserDropdown();
            }}
            className="hover:bg-black hover:text-white text-gray-900 dark:text-white dark:hover:bg-white dark:hover:text-black group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold justify-between cursor-pointer font-poynterroman"
          >
            <LogOut className="mr-2 h-5 w-5" aria-hidden="true" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
