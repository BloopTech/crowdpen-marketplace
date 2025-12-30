"use client";
import React from "react";
import Link from "next/link";
import UserProfilePicture from "../userpfp";

export default function NotificationLayout(props) {
  const {
    readNotification,
    id,
    following,
    url,
    subscribe,
    subscribeStories,
    repen,
    pens,
    comments,
    notificationType,
    content,
    notifyName,
    newUrl,
    challenges,
    transactions,
    topstory,
  } = props;

  const origin =
    (typeof window !== "undefined" && window.location?.origin) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_NEXTAUTH_URL ||
    "";

  const followingUrl = following?.urlPenName
    ? `${origin}/${following?.urlPenName?.pen_name}`
    : `${origin}/${url}`;

  const subscribeUrl = subscribe?.urlPenName
    ? `${origin}/${subscribe?.urlPenName?.pen_name}`
    : `${origin}/${url}`;

  const storiesUrl = subscribeStories?.urlPenName
    ? `${origin}/${subscribeStories?.urlPenName?.pen_name}/${newUrl}`
    : `${origin}/${url}`;

  const pensUrl = pens?.urlPenName
    ? `${origin}/${pens?.urlPenName?.pen_name}/${newUrl}`
    : `${origin}/${url}`;

  const repenUrl = repen?.urlPenName
    ? `${origin}/${repen?.urlPenName?.pen_name}/${newUrl}`
    : `${origin}/${url}`;

  const commentsUrl = comments?.urlPenName
    ? `${origin}/${comments?.urlPenName?.pen_name}/${newUrl}`
    : `${origin}/${url}`;

  const challengesUrl = challenges?.urlPenName
    ? `${origin}/${challenges?.urlPenName?.pen_name}/${newUrl}`
    : `${origin}/${url}`;

  const transactionsUrl = transactions?.urlPenName
    ? `${origin}/${transactions?.urlPenName?.pen_name}/${newUrl}`
    : `${origin}/${url}`;

  const topstoryUrl = `${origin}/${topstory?.urlPenName?.pen_name}/${url}`;
  return (
    <>
      {following ? (
        <Link
          onClick={() => {
            readNotification(id);
          }}
          href={followingUrl}
          className="-m-3 flex rounded-lg p-2 transition duration-150 ease-in-out hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring focus-visible:ring-ring focus-visible:ring-opacity-50 group"
        >
          <div className="flex items-center justify-center p-4 space-x-4">
            <UserProfilePicture
              rounded="rounded-full"
              image={following?.notice?.image}
              name={following?.notice?.name}
              color={following?.notice?.color}
              imageWidth={40}
              imageHeight={40}
              avatarCircle={100}
              avatarHeight={39}
              avatarWidth={39}
              avatarSize={18}
              width={10}
              height={10}
            />
          </div>
          <div className="flex flex-col items-start justify-center">
            <p className="text-base font-bold font-poynterroman">
              {notifyName ? notifyName : notificationType}
            </p>
            <p className="text-sm text-muted-foreground group-hover:text-accent-foreground/80 break-all line-clamp-1 font-poynterroman">
              {content}
            </p>
          </div>
        </Link>
      ) : subscribe ? (
        <Link
          onClick={() => {
            readNotification(id);
          }}
          href={subscribeUrl}
          className="-m-3 flex rounded-lg p-2 transition duration-150 ease-in-out hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring focus-visible:ring-ring focus-visible:ring-opacity-50 group"
        >
          <div className="flex items-center justify-center p-4 space-x-4">
            <UserProfilePicture
              rounded="rounded-full"
              image={subscribe?.notice?.image}
              name={subscribe?.notice?.name}
              color={subscribe?.notice?.color}
              imageWidth={40}
              imageHeight={40}
              avatarCircle={100}
              avatarHeight={39}
              avatarWidth={39}
              avatarSize={18}
              width={10}
              height={10}
            />
          </div>
          <div className="flex flex-col items-start justify-center">
            <p className="text-base font-bold font-poynterroman">
              {notifyName ? notifyName : notificationType}
            </p>
            <p className="text-sm text-muted-foreground group-hover:text-accent-foreground/80 break-all line-clamp-1 font-poynterroman">
              {content}
            </p>
          </div>
        </Link>
      ) : subscribeStories ? (
        <Link
          onClick={() => {
            readNotification(id);
          }}
          href={storiesUrl}
          className="-m-3 flex rounded-lg p-2 transition duration-150 ease-in-out hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring focus-visible:ring-ring focus-visible:ring-opacity-50 group"
        >
          <div className="flex items-center justify-center p-4 space-x-4">
            <UserProfilePicture
              rounded="rounded-full"
              image={subscribeStories?.notice?.image}
              name={subscribeStories?.notice?.name}
              color={subscribeStories?.notice?.color}
              imageWidth={40}
              imageHeight={40}
              avatarCircle={100}
              avatarHeight={39}
              avatarWidth={39}
              avatarSize={18}
              width={10}
              height={10}
            />
          </div>
          <div className="flex flex-col items-start justify-center">
            <p className="text-base font-bold font-poynterroman">
              {notifyName ? notifyName : notificationType}
            </p>
            <p className="text-sm text-muted-foreground group-hover:text-accent-foreground/80 break-all line-clamp-1 font-poynterroman">
              {content}
            </p>
          </div>
        </Link>
      ) : pens ? (
        <Link
          onClick={() => {
            readNotification(id);
          }}
          href={pensUrl}
          className="-m-3 flex rounded-lg p-2 transition duration-150 ease-in-out hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring focus-visible:ring-ring focus-visible:ring-opacity-50 group"
        >
          <div className="flex items-center justify-center p-4 space-x-4">
            <UserProfilePicture
              rounded="rounded-full"
              image={pens?.notice?.image}
              name={pens?.notice?.name}
              color={pens?.notice?.color}
              imageWidth={40}
              imageHeight={40}
              avatarCircle={100}
              avatarHeight={39}
              avatarWidth={39}
              avatarSize={18}
              width={10}
              height={10}
            />
          </div>
          <div className="flex flex-col items-start justify-center">
            <p className="text-base font-bold font-poynterroman">
              {notifyName ? notifyName : "pens"}
            </p>
            <p className="text-sm text-muted-foreground group-hover:text-accent-foreground/80 break-all line-clamp-1 font-poynterroman">
              {content}
            </p>
          </div>
        </Link>
      ) : repen ? (
        <Link
          onClick={() => {
            readNotification(id);
          }}
          href={repenUrl}
          className="-m-3 flex rounded-lg p-2 transition duration-150 ease-in-out hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring focus-visible:ring-ring focus-visible:ring-opacity-50 group"
        >
          <div className="flex items-center justify-center p-4 space-x-4">
            <UserProfilePicture
              rounded="rounded-full"
              image={repen?.notice?.image}
              name={repen?.notice?.name}
              color={repen?.notice?.color}
              imageWidth={40}
              imageHeight={40}
              avatarCircle={100}
              avatarHeight={39}
              avatarWidth={39}
              avatarSize={18}
              width={10}
              height={10}
            />
          </div>
          <div className="flex flex-col items-start justify-center">
            <p className="text-base font-bold font-poynterroman">
              {notifyName ? notifyName : "repen"}
            </p>
            <p className="text-sm text-muted-foreground group-hover:text-accent-foreground/80 break-all line-clamp-1 font-poynterroman">
              {content}
            </p>
          </div>
        </Link>
      ) : comments ? (
        <Link
          onClick={() => {
            readNotification(id);
          }}
          href={commentsUrl}
          className="-m-3 flex rounded-lg p-2 transition duration-150 ease-in-out hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring focus-visible:ring-ring focus-visible:ring-opacity-50 group"
        >
          <div className="flex items-center justify-center p-4 space-x-4">
            <UserProfilePicture
              rounded="rounded-full"
              image={comments?.notice?.image}
              name={comments?.notice?.name}
              color={comments?.notice?.color}
              imageWidth={40}
              imageHeight={40}
              avatarCircle={100}
              avatarHeight={39}
              avatarWidth={39}
              avatarSize={18}
              width={10}
              height={10}
            />
          </div>
          <div className="flex flex-col items-start justify-center">
            <p className="text-base font-bold font-poynterroman">
              {notifyName ? notifyName : notificationType}
            </p>
            <p className="text-sm text-muted-foreground group-hover:text-accent-foreground/80 break-all line-clamp-1 font-poynterroman">
              {content}
            </p>
          </div>
        </Link>
      ) : topstory ? (
        <Link
          onClick={() => {
            readNotification(id);
          }}
          href={topstoryUrl}
          className="-m-3 flex rounded-lg p-2 transition duration-150 ease-in-out hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring focus-visible:ring-ring focus-visible:ring-opacity-50 group"
        >
          <div className="flex items-center justify-center p-4 space-x-4">
            <UserProfilePicture
              rounded="rounded-full"
              image={topstory?.notice?.image}
              name={topstory?.notice?.name}
              color={topstory?.notice?.color}
              imageWidth={40}
              imageHeight={40}
              avatarCircle={100}
              avatarHeight={39}
              avatarWidth={39}
              avatarSize={18}
              width={10}
              height={10}
            />
          </div>
          <div className="flex flex-col items-start justify-center">
            <p className="text-base font-bold font-poynterroman">
              {notifyName ? notifyName : notificationType}
            </p>
            <p className="text-sm text-muted-foreground group-hover:text-accent-foreground/80 break-all line-clamp-1 font-poynterroman">
              {content}
            </p>
          </div>
        </Link>
      ) : challenges ? (
        <Link
          onClick={() => {
            readNotification(id);
          }}
          href={challengesUrl}
          className="-m-3 flex rounded-lg p-2 transition duration-150 ease-in-out hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring focus-visible:ring-ring focus-visible:ring-opacity-50 group"
        >
          <div className="flex items-center justify-center p-4 space-x-4">
            <UserProfilePicture
              rounded="rounded-full"
              image={challenges?.notice?.image}
              name={challenges?.notice?.name}
              color={challenges?.notice?.color}
              imageWidth={40}
              imageHeight={40}
              avatarCircle={100}
              avatarHeight={39}
              avatarWidth={39}
              avatarSize={18}
              width={10}
              height={10}
            />
          </div>
          <div className="flex flex-col items-start justify-center">
            <p className="text-base font-bold font-poynterroman">
              {notifyName ? notifyName : notificationType}
            </p>
            <p className="text-sm text-muted-foreground group-hover:text-accent-foreground/80 break-all line-clamp-1 font-poynterroman">
              {content}
            </p>
          </div>
        </Link>
      ) : transactions ? (
        <Link
          onClick={() => {
            readNotification(id);
          }}
          href={transactionsUrl}
          className="-m-3 flex rounded-lg p-2 transition duration-150 ease-in-out hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring focus-visible:ring-ring focus-visible:ring-opacity-50 group"
        >
          <div className="flex items-center justify-center p-4 space-x-4">
            <UserProfilePicture
              rounded="rounded-full"
              image={transactions?.notice?.image}
              name={transactions?.notice?.name}
              color={transactions?.notice?.color}
              imageWidth={40}
              imageHeight={40}
              avatarCircle={100}
              avatarHeight={39}
              avatarWidth={39}
              avatarSize={18}
              width={10}
              height={10}
            />
          </div>
          <div className="flex flex-col items-start justify-center">
            <p className="text-base font-bold font-poynterroman">
              {notifyName ? notifyName : notificationType}
            </p>
            <p className="text-sm text-muted-foreground group-hover:text-accent-foreground/80 break-all line-clamp-1 font-poynterroman">
              {content}
            </p>
          </div>
        </Link>
      ) : null}
    </>
  );
}
