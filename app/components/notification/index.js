"use client";
import React, { Fragment, useState, useEffect } from "react";
import {
  Popover,
  Transition,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import { Bell } from "lucide-react";
import millify from "millify";
import Link from "next/link";
import NotificationLayout from "./layout";

export default function NotificationUser(props) {
  const { myNotifications, notifyCount } = props;
  //console.log("myNotifications", myNotifications);

  // const readNotification = async (id) => {
  //   try {
  //     const payload = {
  //       id,
  //     };
  //     await axios.put(`/api/auth/users/notification/readNotification`, payload);
  //     await revalidateLiveQueries();
  //   } catch (err) {
  //     console.log(err);
  //   }
  // };

  return (
    <div>
      <Popover className="relative">
        {({ open }) => (
          <>
            <PopoverButton
              className={`
                ${open ? "" : "text-opacity-90"}
                group flex items-center justify-center cursor-pointer`}
            >
              <Bell className="text-[25px]" />
              {notifyCount > 0 ? (
                <span className="absolute inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-black border-2 border-white rounded-full -top-2 -right-2 dark:border-gray-900 dark:bg-[#f2f2f2] dark:text-black">
                  {notifyCount > 99 ? <span>99<sup>+</sup></span> : millify(notifyCount)}
                </span>
              ) : null}
            </PopoverButton>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <PopoverPanel className="absolute right-1/2 z-10 mt-3 w-screen max-w-sm transform sm:px-0 lg:max-w-md ">
                <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-slate-300 ring-opacity-5">
                  <div className="relative bg-white text-black p-3 flex flex-col space-y-4 overflow-hidden dark:bg-[#1a1a1a] dark:text-white">
                    {myNotifications?.length
                      ? myNotifications
                          .slice(0, 3)
                          .map(
                            ({
                              notificationType,
                              content,
                              id,
                              url,
                              following,
                              subscribe,
                              subscribeStories,
                              pens,
                              comments,
                              repen,
                              notifyName,
                              challenges,
                              transactions,
                              topstory,
                            }) => {
                              const removePenName = (link) => {
                                return link
                                  .replace(/@[\w]+\//, "/")
                                  .replace(/@[\w]+/, "");
                              };

                              const newUrl = removePenName(url);
                              return (
                                <div key={id}>
                                  <NotificationLayout
                                    readNotification={() => {}}
                                    id={id}
                                    following={following}
                                    url={url}
                                    subscribe={subscribe}
                                    subscribeStories={subscribeStories}
                                    repen={repen}
                                    pens={pens}
                                    comments={comments}
                                    notificationType={notificationType}
                                    content={content}
                                    notifyName={notifyName}
                                    newUrl={newUrl}
                                    challenges={challenges}
                                    transactions={transactions}
                                    topstory={topstory}
                                  />
                                </div>
                              );
                            }
                          )
                      : null}
                  </div>
                  <div className="bg-gray-50 p-1 dark:bg-[#1a1a1a] dark:border-t dark:border-[#f2f2f2]">
                    <Link
                      href="/creator/notifications"
                      className="flow-root hover:underline rounded-md p-1 transition duration-150 ease-in-out hover:bg-gray-100 dark:hover:bg-inherit focus:outline-none focus-visible:ring focus-visible:ring-orange-500 focus-visible:ring-opacity-50"
                    >
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          See all
                        </span>
                      </div>
                    </Link>
                  </div>
                </div>
              </PopoverPanel>
            </Transition>
          </>
        )}
      </Popover>
    </div>
  );
}
