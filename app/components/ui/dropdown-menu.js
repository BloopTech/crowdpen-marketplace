"use client";

import React, { forwardRef } from "react";
import * as DropdownMenuPrimitives from "@radix-ui/react-dropdown-menu";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Circle,
  CircleCheck,
} from "lucide-react";

import { cn } from "../../lib/utils";

const DropdownMenu = DropdownMenuPrimitives.Root;
DropdownMenu.displayName = "DropdownMenu";

const DropdownMenuTrigger = DropdownMenuPrimitives.Trigger;
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuGroup = DropdownMenuPrimitives.Group;
DropdownMenuGroup.displayName = "DropdownMenuGroup";

const DropdownMenuSubMenu = DropdownMenuPrimitives.Sub;
DropdownMenuSubMenu.displayName = "DropdownMenuSubMenu";

const DropdownMenuRadioGroup = DropdownMenuPrimitives.RadioGroup;
DropdownMenuRadioGroup.displayName = "DropdownMenuRadioGroup";

const DropdownMenuSubMenuTrigger = forwardRef(
  ({ className, children, ...props }, forwardedRef) => (
    <DropdownMenuPrimitives.SubTrigger
      ref={forwardedRef}
      className={cn(
        // base
        "relative flex cursor-default select-none items-center rounded py-1.5 pl-2 pr-1 outline-none transition-colors data-[state=checked]:font-semibold sm:text-sm",
        // text color
        "text-foreground",
        // disabled
        "data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground",
        // focus
        "focus-visible:bg-accent focus-visible:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        // hover
        "hover:bg-accent hover:text-accent-foreground",
        //
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight
        className="ml-auto size-4 shrink-0"
        aria-hidden="true"
      />
    </DropdownMenuPrimitives.SubTrigger>
  )
);
DropdownMenuSubMenuTrigger.displayName = "DropdownMenuSubMenuTrigger";

const DropdownMenuSubMenuContent = forwardRef(
  ({ className, collisionPadding = 8, ...props }, forwardedRef) => (
    <DropdownMenuPrimitives.Portal>
      <DropdownMenuPrimitives.SubContent
        ref={forwardedRef}
        collisionPadding={collisionPadding}
        className={cn(
          // base
          "relative z-50 overflow-hidden rounded-md border p-1 shadow-xl shadow-black/[2.5%]",
          // widths
          "min-w-32",
          // heights
          "max-h-[var(--radix-popper-available-height)]",
          // background color
          "bg-popover",
          // text color
          "text-popover-foreground",
          // border color
          "border-border",
          // transition
          "will-change-[transform,opacity]",
          // "data-[state=open]:animate-slideDownAndFade",
          "data-[state=closed]:animate-hide",
          "data-[side=bottom]:animate-slideDownAndFade data-[side=left]:animate-slideLeftAndFade data-[side=right]:animate-slideRightAndFade data-[side=top]:animate-slideUpAndFade",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitives.Portal>
  )
);
DropdownMenuSubMenuContent.displayName = "DropdownMenuSubMenuContent";

const DropdownMenuContent = forwardRef(
  (
    {
      className,
      sideOffset = 8,
      collisionPadding = 8,
      align = "center",
      loop = true,
      ...props
    },
    forwardedRef
  ) => (
    <DropdownMenuPrimitives.Portal>
      <DropdownMenuPrimitives.Content
        ref={forwardedRef}
        className={cn(
          // base
          "relative z-50 overflow-hidden rounded-md border p-1 shadow-xl shadow-black/[2.5%]",
          // widths
          "min-w-[calc(var(--radix-dropdown-menu-trigger-width))]",
          // heights
          "max-h-[var(--radix-popper-available-height)]",
          // background color
          "bg-popover",
          // text color
          "text-popover-foreground",
          // border color
          "border-border",
          // transition
          "will-change-[transform,opacity]",
          "data-[state=closed]:animate-hide",
          "data-[side=bottom]:animate-slideDownAndFade data-[side=left]:animate-slideLeftAndFade data-[side=right]:animate-slideRightAndFade data-[side=top]:animate-slideUpAndFade",
          className
        )}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={collisionPadding}
        loop={loop}
        {...props}
      />
    </DropdownMenuPrimitives.Portal>
  )
);
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = forwardRef(
  ({ className, shortcut, hint, children, ...props }, forwardedRef) => (
    <DropdownMenuPrimitives.Item
      ref={forwardedRef}
      className={cn(
        // base
        "group/DropdownMenuItem relative flex cursor-pointer select-none items-center rounded outline-none transition-colors data-[state=checked]:font-semibold sm:text-sm",
        // text color
        "text-foreground",
        // disabled
        "data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground",
        // focus
        "focus-visible:bg-accent focus-visible:text-accent-foreground",
        // hover
        "hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
      {hint && (
        <span
          className={cn(
            "ml-auto pl-2 text-sm text-muted-foreground"
          )}
        >
          {hint}
        </span>
      )}
      {shortcut && (
        <span
          className={cn(
            "ml-auto pl-2 text-sm text-muted-foreground"
          )}
        >
          {shortcut}
        </span>
      )}
    </DropdownMenuPrimitives.Item>
  )
);
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuCheckboxItem = forwardRef(
  (
    { className, hint, shortcut, children, checked, ...props },
    forwardedRef
  ) => (
    <DropdownMenuPrimitives.CheckboxItem
      ref={forwardedRef}
      className={cn(
        // base
        "relative flex cursor-pointer select-none items-center gap-x-2 rounded py-1.5 pl-8 pr-1 outline-none transition-colors data-[state=checked]:font-semibold sm:text-sm",
        // text color
        "text-foreground",
        // disabled
        "data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground",
        // focus
        "focus-visible:bg-accent focus-visible:text-accent-foreground",
        // hover
        "hover:bg-accent hover:text-accent-foreground",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitives.ItemIndicator>
          <Check
            aria-hidden="true"
            className="size-full shrink-0 text-gray-800 dark:text-gray-200"
          />
        </DropdownMenuPrimitives.ItemIndicator>
      </span>
      {children}
      {hint && (
        <span
          className={cn(
            "ml-auto text-sm font-normal text-muted-foreground"
          )}
        >
          {hint}
        </span>
      )}
      {shortcut && (
        <span
          className={cn(
            "ml-auto text-sm font-normal tracking-widest text-muted-foreground"
          )}
        >
          {shortcut}
        </span>
      )}
    </DropdownMenuPrimitives.CheckboxItem>
  )
);
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

const DropdownMenuRadioItem = forwardRef(
  (
    { className, hint, shortcut, children, iconType = "radio", ...props },
    forwardedRef
  ) => (
    <DropdownMenuPrimitives.RadioItem
      ref={forwardedRef}
      className={cn(
        // base
        "group/DropdownMenuRadioItem relative flex cursor-pointer select-none items-center gap-x-2 rounded py-1.5 pl-8 pr-1 outline-none transition-colors data-[state=checked]:font-semibold sm:text-sm",
        // text color
        "text-foreground",
        // disabled
        "data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground",
        // focus
        "focus-visible:bg-accent focus-visible:text-accent-foreground",
        // hover
        "hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    >
      {iconType === "radio" ? (
        <span className="absolute left-2 flex size-4 items-center justify-center">
          <Circle
            aria-hidden="true"
            className="size-full shrink-0 text-blue-500 group-data-[state=checked]/DropdownMenuRadioItem:flex group-data-[state=unchecked]/DropdownMenuRadioItem:hidden dark:text-blue-500"
          />
          <CircleCheck
            aria-hidden="true"
            className="size-full shrink-0 text-gray-300 group-data-[state=unchecked]/DropdownMenuRadioItem:flex group-data-[state=checked]/DropdownMenuRadioItem:hidden dark:text-gray-700"
          />
        </span>
      ) : iconType === "check" ? (
        <span className="absolute left-2 flex size-4 items-center justify-center">
          <Check
            aria-hidden="true"
            className="size-full shrink-0 text-gray-800 group-data-[state=checked]/DropdownMenuRadioItem:flex group-data-[state=unchecked]/DropdownMenuRadioItem:hidden dark:text-gray-200"
          />
        </span>
      ) : null}
      {children}
      {hint && (
        <span
          className={cn(
            "ml-auto text-sm font-normal text-muted-foreground"
          )}
        >
          {hint}
        </span>
      )}
      {shortcut && (
        <span
          className={cn(
            "ml-auto text-sm font-normal tracking-widest text-muted-foreground"
          )}
        >
          {shortcut}
        </span>
      )}
    </DropdownMenuPrimitives.RadioItem>
  )
);
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

const DropdownMenuLabel = forwardRef(
  ({ className, ...props }, forwardedRef) => (
    <DropdownMenuPrimitives.Label
      ref={forwardedRef}
      className={cn(
        // base
        "px-2 py-2 text-xs font-medium tracking-wide",
        // text color
        "text-muted-foreground",
        className
      )}
      {...props}
    />
  )
);
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = forwardRef(
  ({ className, ...props }, forwardedRef) => (
    <DropdownMenuPrimitives.Separator
      ref={forwardedRef}
      className={cn(
        "-mx-1 my-1 h-px border-t border-border",
        className
      )}
      {...props}
    />
  )
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuIconWrapper = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        // text color
        "text-muted-foreground",
        // disabled
        "group-data-[disabled]/DropdownMenuItem:text-gray-400 group-data-[disabled]/DropdownMenuItem:dark:text-gray-700",
        className
      )}
      {...props}
    />
  );
};
DropdownMenuIconWrapper.displayName = "DropdownMenuIconWrapper";

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuIconWrapper,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSubMenu,
  DropdownMenuSubMenuContent,
  DropdownMenuSubMenuTrigger,
  DropdownMenuTrigger,
};
