"use client";

import React, {forwardRef} from "react";
import * as DialogPrimitives from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn, focusRing } from "../../lib/utils";


const Dialog = (props) => {
  return <DialogPrimitives.Root {...props} />;
};
Dialog.displayName = "Dialog";

const DialogTrigger = DialogPrimitives.Trigger;

DialogTrigger.displayName = "DialogTrigger";

const DialogClose = DialogPrimitives.Close;

DialogClose.displayName = "DialogClose";

const DialogPortal = DialogPrimitives.Portal;

DialogPortal.displayName = "DialogPortal";

const DialogOverlay = forwardRef(({ className, ...props }, forwardedRef) => {
  return (
    <DialogPrimitives.Overlay
      ref={forwardedRef}
      className={cn(
        // base
        "fixed inset-0 z-50 overflow-y-auto",
        // background color
        "bg-black/70",
        // transition
        "data-[state=open]:animate-dialogOverlayShow",
        className
      )}
      {...props}
    />
  );
});

DialogOverlay.displayName = "DialogOverlay";

const DialogContent = forwardRef(({ className, ...props }, forwardedRef) => {
  return (
    <DialogPortal>
      <DialogOverlay>
        <DialogPrimitives.Content
          ref={forwardedRef}
          className={cn(
            // base
            "fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border p-6 shadow-lg",
            // border color
            "border-border",
            // background color
            "bg-popover text-popover-foreground",
            // transition
            "data-[state=open]:animate-dialogContentShow",
            focusRing,
            className
          )}
          {...props}
        />
      </DialogOverlay>
    </DialogPortal>
  );
});

DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }) => {
  return <div className={cn("flex flex-col gap-y-1", className)} {...props} />;
};

DialogHeader.displayName = "DialogHeader";

const DialogTitle = forwardRef(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Title
    ref={forwardedRef}
    className={cn(
      // base
      "text-lg font-semibold",
      // text color
      "text-foreground",
      className
    )}
    {...props}
  />
));

DialogTitle.displayName = "DialogTitle";

const DialogDescription = forwardRef(
  ({ className, ...props }, forwardedRef) => {
    return (
      <DialogPrimitives.Description
        ref={forwardedRef}
        className={cn("text-muted-foreground", className)}
        {...props}
      />
    );
  }
);

DialogDescription.displayName = "DialogDescription";

const DialogFooter = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        className
      )}
      {...props}
    />
  );
};

DialogFooter.displayName = "DialogFooter";

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
