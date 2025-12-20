"use client";
import React, { useState, Fragment, useEffect, useRef } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Menu, Transition, MenuItem, MenuItems } from "@headlessui/react";
import {
  LogOut,
  Bell,
  ShieldCheck,
  BookOpen,
  User,
  PenSquare,
  Trophy,
  BarChart2,
  Circle,
  Plus,
  Crown,
  Wallet,
  LayoutGrid,
  Settings
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "../../ui/tooltip";
import { useTheme } from "next-themes";
import UserProfilePicture from "../../userpfp";
import ThemeToggle from "../../themetoggle";

export function UserId() {
  const [mounted, setMounted] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const menuRef = useRef(null);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

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
      <Menu as="div" className="relative inline-block text-left">
        <div className="mt-1">
          <div className="relative">
            <UserProfilePicture
              rounded="rounded-[10px]"
              image={session?.user?.image}
              name={session?.user?.name}
              color={session?.user?.color}
              imageWidth={36}
              imageHeight={36}
              avatarCircle={20}
              avatarHeight={36}
              avatarWidth={36}
              avatarSize={16}
              width={9}
              height={9}
              onClick={toggleUserDropdown}
            />
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
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
          show={userOpen}
        >
          <MenuItems
            ref={menuRef}
            className="px-1 py-1 absolute z-20 overflow-y-auto h-[21rem] right-0 mt-2 w-56 origin-top-right divide-y divide-border rounded-md bg-popover text-popover-foreground shadow-lg border border-border focus:outline-none"
          >
            <MenuItem>
              <Link href="https://crowdpen.co/creator/profile">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={closeUserDropdown}
                >
                  <User className="mr-2 h-5 w-5" aria-hidden="true" />
                  Profile
                </div>
              </Link>
            </MenuItem>
            <MenuItem>
              <Link href="https://crowdpen.co/creator/stories">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={() => {
                    closeUserDropdown();
                  }}
                >
                  <BookOpen className="mr-2 h-5 w-5" aria-hidden="true" />
                  Stories
                </div>
              </Link>
            </MenuItem>
            <MenuItem>
              <Link href="https://crowdpen.co/creator/pens">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={() => {
                    closeUserDropdown();
                  }}
                >
                  <PenSquare className="mr-2 h-5 w-5" aria-hidden="true" />
                  Pens
                </div>
              </Link>
            </MenuItem>
            {/* <MenuItem>
              <Link href="https://crowdpen.co/creator/crowdlist">
                <div
                  className={`hover:bg-black hover:text-white text-gray-900 dark:text-white dark:hover:bg-white dark:hover:text-black group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={() => {
                    closeUserDropdown();
                  }}
                >
                  <CgUserList className="mr-2 h-5 w-5" aria-hidden="true" />
                  Crowdlist
                </div>
              </Link>
            </MenuItem> */}
            <MenuItem>
              <Link href="https://crowdpen.co/creator/content-stats">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={() => {
                    closeUserDropdown();
                  }}
                >
                  <BarChart2 className="mr-2 h-5 w-5" aria-hidden="true" />
                  Stats
                </div>
              </Link>
            </MenuItem>
            <MenuItem>
              <Link href="https://crowdpen.co/challenges">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={() => {
                    closeUserDropdown();
                  }}
                >
                  <Trophy className="mr-2 h-5 w-5" aria-hidden="true" />
                  Challenges
                </div>
              </Link>
            </MenuItem>

            <div className="md:hidden flex flex-col w-full">
              <MenuItem>
                <Link href="https://crowdpen.co/creator/stories/write">
                  <div
                    className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                    onClick={() => {
                      closeUserDropdown();
                    }}
                  >
                    <BookOpen className="mr-2 h-5 w-5" aria-hidden="true" />
                    Create Story
                  </div>
                </Link>
              </MenuItem>
              
              <MenuItem>
                <Link href="https://crowdpen.co/creator/notifications">
                  <div
                    className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                    onClick={closeUserDropdown}
                  >
                    <Bell
                      className="mr-2 h-5 w-5"
                      aria-hidden="true"
                    />
                    Notifications
                  </div>
                </Link>
              </MenuItem>
            </div>

            {/* <MenuItem>
            
                  <Link href="https://crowdpen.co/recommendation">
                    <div
                      className={`hover:bg-black hover:text-white text-gray-900 dark:text-white dark:hover:bg-white dark:hover:text-black group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                      onClick={closeUserDropdown}
                    >
                      Recommendation
                    </div>
                  </Link>
                
              </MenuItem> */}
            <MenuItem>
              <Link href="https://crowdpen.co/become-a-partner">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={closeUserDropdown}
                >
                  <Crown className="mr-2 h-5 w-5" aria-hidden="true" />
                  Crowdpen
                  <Plus />
                </div>
              </Link>
            </MenuItem>
            <MenuItem>
              <Link href="https://crowdpen.co/creator/wallet">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={closeUserDropdown}
                >
                  <Wallet
                    className="mr-2 h-5 w-5"
                    aria-hidden="true"
                  />
                  Wallet
                </div>
              </Link>
            </MenuItem>
            <MenuItem>
              <Link href="https://crowdpen.co/creator/referrals">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={closeUserDropdown}
                >
                  <span className="rotate-45 relative -mt-[3rem]">
                    <Circle
                      size={20}
                      className="absolute -right-[2rem]"
                    />
                    <Circle size={20} className="absolute -right-11" />
                  </span>
                  <span className="pl-8">Referrals</span>
                </div>
              </Link>
            </MenuItem>
            <MenuItem>
              <Link href="https://crowdpen.co/creator/settings">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={closeUserDropdown}
                >
                  <Settings className="mr-2 h-5 w-5" aria-hidden="true" />
                  Settings
                </div>
              </Link>
            </MenuItem>

            <MenuItem>
              <Link href="https://crowdpen.co/creator/leaderboard">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={closeUserDropdown}
                >
                  <LayoutGrid className="mr-2 h-5 w-5" aria-hidden="true" />
                  Leaderboard
                </div>
              </Link>
            </MenuItem>
            {session?.user?.role === "senior_admin" ||
            session?.user?.role === "admin" ? (
              <MenuItem>
                <Link href="https://crowdpen.co/admin/dashboard">
                  <div
                    className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                    onClick={closeUserDropdown}
                  >
                    <ShieldCheck
                      className="mr-2 h-5 w-5"
                      aria-hidden="true"
                    />
                    Admin
                  </div>
                </Link>
              </MenuItem>
            ) : null}
            <MenuItem>
              <Link href="https://crowdpen.co/help">
                <div
                  className={`text-foreground hover:bg-accent hover:text-accent-foreground group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                  onClick={closeUserDropdown}
                >
                  Help
                </div>
              </Link>
            </MenuItem>

            <MenuItem>
              <ThemeToggle />
            </MenuItem>

            <MenuItem>
              <div
                className={`text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer group flex w-full items-center rounded-md px-2 py-2 text-sm font-semibold font-poynterroman`}
                onClick={() => {
                  signOut();
                  closeUserDropdown();
                }}
              >
                <LogOut className="mr-2 h-5 w-5" aria-hidden="true" />
                Logout
              </div>
            </MenuItem>
          </MenuItems>
        </Transition>
      </Menu>
    </div>
  );
}
