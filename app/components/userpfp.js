"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import Avatar from "./avatar";

export default function UserProfilePicture(props) {
  const {
    image,
    name,
    color,
    imageWidth,
    imageHeight,
    avatarCircle,
    avatarHeight,
    avatarWidth,
    avatarSize,
    rounded,
    width,
    height,
    otherclass,
    ...rest
  } = props;

  return (
    <>
      {image ? (
        <div
          className={`bg-[#eeeeee] dark:border dark:border-[#f2f2f2] ${rounded} ${
            otherclass && otherclass
          }`}
          {...rest}
          style={{
            width: `${imageWidth}px`,
            height: `${imageHeight}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <Image
            src={image}
            alt={name}
            fetchPriority="auto"
            // width={imageWidth}
            // height={imageHeight}
            fill
            sizes={`${imageWidth}px`}
            className={`object-cover`}
            quality={75}
          />
        </div>
      ) : (
        <Avatar
          name={name}
          color={color}
          width={avatarWidth}
          height={avatarHeight}
          circle={avatarCircle}
          size={avatarSize}
          {...rest}
          className={`${otherclass && otherclass}`}
        />
      )}
    </>
  );
}
