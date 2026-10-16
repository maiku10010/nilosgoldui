import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium font-sans tabular-nums w-fit whitespace-nowrap shrink-0 [&>svg]:size-3",
  { variants: { variant: {
    success: "bg-success-tint text-success",
    warning: "bg-warning-tint text-warning",
    danger: "bg-danger-tint text-danger",
    neutral: "bg-muted text-muted-foreground",
  } }, defaultVariants: { variant: "neutral" } },
);

export function sentenceCase(value: string) {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const statusVariants: Record<string, "success" | "warning" | "danger"> = {
  paid: "success", finished: "success", approved: "success", released: "success", yes: "success",
  pending: "warning", ongoing: "warning", "in progress": "warning", partial: "warning", "ready for pickup": "warning",
  rejected: "danger", cancelled: "danger", no: "danger", delete: "danger", archive: "danger",
};

function Badge({ className, variant, status, asChild = false, children, ...props }:
  React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean; status?: string }) {
  const Comp = asChild ? Slot : "span";
  const content = status ?? children;
  const resolved = variant ?? (status ? statusVariants[status.replaceAll("_", " ").toLowerCase()] : undefined) ?? "neutral";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant: resolved }), className)} {...props}>
    {typeof content === "string" ? sentenceCase(content) : content}
  </Comp>;
}
export { Badge, badgeVariants };
