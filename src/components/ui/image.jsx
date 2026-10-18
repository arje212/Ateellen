import React from "react";
import { cn } from "@/lib/utils";

export const Image = React.forwardRef(function Image(
  { className, fittingType = "cover", ...props },
  ref,
) {
  const objectFit = fittingType === "fill" ? "object-cover" : `object-${fittingType}`;

  return (
    <img
      ref={ref}
      className={cn(objectFit, className)}
      {...props}
    />
  );
});