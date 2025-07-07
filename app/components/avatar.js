"use client";
import React from "react";

const Avatar = ({ name, color, width, height, circle, size, ...rest }) => {
  //const initials = `${name?.split(" ")[0][0]}${name?.split(" ")[1][0]}`;

  const words = name?.split(" ");

  const result = words?.map((word) => word?.charAt(0));

  const initials = result?.slice(0, 2)?.join("");

  return (
    <div
      {...rest}
      style={{
        backgroundColor: color,
        borderRadius: `${circle}%`,
        width: `${width}px`,
        height: `${height}px`,
        fontSize: `${size}px`,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {initials}
    </div>
  );
};

export default Avatar;
