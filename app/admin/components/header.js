"use client";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import ProfileImage from "./profileimage";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

export default function AdminHeader() {
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }


  return (
    <>
      <nav
        className="fixed left-0 top-0 z-10 w-full hidden lg:inline-block"
        data-testid="admin-header"
      >
        <div
          className="text-sm flex justify-end items-center space-x-8 md:px-10 py-[0.29rem]"
          data-testid="admin-header-inner"
        >
          {session ? (
            <div data-testid="admin-header-profile">
              <ProfileImage />
            </div>
          ) : null}
        </div>
      </nav>
    </>
  );
}
