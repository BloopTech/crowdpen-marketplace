"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import logo from "../../../public/crowdpen_icon.png";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import {
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

function UnauthenticatedNavBar(props) {
  const [openMenu, setOpenMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');

  const callback = callbackUrl || '/';

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <nav className="fixed left-0 top-0 w-full z-10">
      <div className="lg:flex lg:justify-between lg:items-center md:px-10 px-5 bg-white text-black dark:bg-[#121212] dark:text-white">
        <div className="flex justify-between items-center -ml-7">
          <div>
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
          <span
            onClick={() => setOpenMenu(!openMenu)}
            className="text-[35px] text-black dark:text-white lg:hidden block cursor-pointer lg:mt-0"
          >
            {openMenu ? <X /> : <Menu />}
          </span>
        </div>

        <ul
          className={`lg:flex lg:items-center z-[-1] lg:z-auto lg:static absolute w-full left-0 lg:w-auto lg:py-0 py-4 lg:pl-0 pl-7 lg:opacity-100 opacity-0 transition-all ease-in duration-500 ${
            openMenu
              ? "opacity-[100%] text-black-500 bg-white dark:bg-[#121212] ml-10"
              : "top-[-490px] "
          } `}
        >
          <li className="font-poynterroman mr-4 text-base mt-3 lg:mt-0 font-semibold hover:bg-slate-200 dark:hover:text-black  hover:rounded-[10px] w-[5.5rem] h-9 flex items-center duration-500 justify-center">
            <Link href="https://crowdpen.co/stories">Stories</Link>
          </li>
          <li className="font-poynterroman mr-4 text-base mt-3 lg:mt-0 font-semibold hover:bg-slate-200 dark:hover:text-black  hover:rounded-[10px] w-[5.5rem] h-9 flex items-center duration-500 justify-center">
            <Link href="https://crowdpen.co/pens">Pens</Link>
          </li>
          <li className="font-poynterroman mr-4 text-base mt-3 lg:mt-0 font-semibold hover:bg-slate-200 dark:hover:text-black hover:rounded-[10px] w-[5.5rem] h-9 flex items-center duration-500 justify-center">
            <Link href="https://crowdpen.co/challenges">Challenges</Link>
          </li>
          <li
            className="font-poynterroman duration-500 mr-4 text-base hover:bg-slate-200 dark:hover:text-black hover:rounded-[10px] w-[5.5rem] h-9 mt-3 lg:mt-0 font-semibold flex items-center justify-center cursor-pointer"
            onClick={() => signIn()}
          >
            Sign In
          </li>
          <li
            className={`font-poynterroman mt-3 lg:mt-0 bg-black font-semibold text-white rounded-[10px] w-[5.5rem] h-9 text-base hover:bg-white hover:text-black hover:border-black hover:border-2 cursor-pointer flex items-center justify-center dark:text-black dark:bg-[#d3a155] dark:hover:bg-[#f2f2f2] dark:hover:text-black  mr-4`}
            onClick={() =>
              router.push(`https://crowdpen.co/signup?callbackUrl=${encodeURIComponent(callback)}`)
            }
          >
            Sign Up
          </li>

          {/* <li
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="dark:text-[#d3a155] flex items-center justify-center cursor-pointer mt-3 lg:mt-0 font-semibold"
          >
            {theme ? (
              theme === "dark" ? (
                <MdOutlineNightlight size={24} />
              ) : (
                <MdOutlineLightMode size={24} />
              )
            ) : (
              <MdOutlineLightMode size={24} />
            )}
          </li> */}
        </ul>
      </div>
    </nav>
  );
}

export default UnauthenticatedNavBar;