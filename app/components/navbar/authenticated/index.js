"use client";
import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import logo from "../../../../public/crowdpen_icon.png";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { UserId } from "./imagedropdown";
import useSWR from "swr";
import NotificationUser from "../../notification";
import { useTheme } from "next-themes";

export default function AuthenticatedNavBar() {
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  const { data: notifications } = useSWR(
    `https://crowdpen.co/api/auth/users/notification/getNotification`
  );

  const myNotifications = useMemo(() => {
    if (notifications) {
      return notifications;
    }
  }, [notifications]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <nav className="fixed left-0 top-0 z-10 w-full">
      <div className="flex md:px-10 px-5 bg-background text-foreground items-center h-auto justify-center border-b border-border">
        <div className={`flex grow -ml-7`}>
          <Link href="https://crowdpen.co">
            <Image
              src={logo}
              alt="logo"
              width={30}
              height={30}
              priority
              className="dark:invert w-auto h-auto"
            />
          </Link>
        </div>

        <ul
          className={`md:flex md:items-center z-[-1] md:z-auto md:static absolute w-full left-0 md:w-auto md:py-0 md:pl-0 pl-7 md:opacity-100 opacity-0 transition-all ease-in duration-500 top-[-490px] `}
        >
          {myNotifications?.count ? (
            <li className="mr-4 mt-3 md:mt-0 ">
              <NotificationUser
                myNotifications={myNotifications?.notifications}
                notifyCount={myNotifications?.count}
              />
            </li>
          ) : (
            <li className="mr-4 mt-3 md:mt-0 ">
              <Link href="https://crowdpen.co/creator/notifications">
                <Bell className="text-[25px]" />
              </Link>
            </li>
          )}
        </ul>

        <div className={`flex items-center`}>{session ? <UserId /> : null}</div>
      </div>
    </nav>
  );
}
