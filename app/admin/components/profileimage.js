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
  TooltipProvider,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
              <Avatar className="w-8 h-8 ring-4 ring-border shadow-xl">
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#d3a155]"></span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        You&apos;re now on the plus membership 🎉
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="bottom"
          align="end"
          className="w-40"
        >
          <DropdownMenuItem
            onClick={() => {
              router.push("/");
              closeUserDropdown();
            }}
            className="w-full justify-between font-semibold cursor-pointer font-poynterroman"
          >
            <LayoutDashboard className="mr-2 h-5 w-5" aria-hidden="true" />
            Dashboard
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              router.push("/creator/profile");
              closeUserDropdown();
            }}
            className="w-full justify-between font-semibold cursor-pointer font-poynterroman"
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
            className="w-full justify-between font-semibold cursor-pointer font-poynterroman"
          >
            <LogOut className="mr-2 h-5 w-5" aria-hidden="true" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
