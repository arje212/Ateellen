import React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { cn } from "@/lib/utils";

export const InputOTP = React.forwardRef(function InputOTP(
  { className, containerClassName, ...props },
  ref,
) {
  return (
    <OTPInput
      ref={ref}
      containerClassName={cn("flex items-center gap-2", containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
});

export function InputOTPGroup({ className, ...props }) {
  return <div className={cn("flex items-center", className)} {...props} />;
}

export const InputOTPSlot = React.forwardRef(function InputOTPSlot(
  { index, className, ...props },
  ref,
) {
  const { slots } = React.useContext(OTPInputContext);
  const slot = slots[index];

  return (
    <div
      ref={ref}
      data-active={slot.isActive}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center border-y border-r border-input bg-background text-sm first:rounded-l-md first:border-l last:rounded-r-md",
        slot.isActive && "z-10 ring-2 ring-ring ring-offset-2 ring-offset-background",
        className,
      )}
      {...props}
    >
      {slot.char}
      {slot.hasFakeCaret && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-4 w-px animate-pulse bg-foreground" />
        </span>
      )}
    </div>
  );
});