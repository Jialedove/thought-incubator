import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-45", {
  variants: {
    variant: {
      primary: "bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--ink-soft)]",
      secondary: "border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-raised)]",
      ghost: "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]",
      danger: "border border-[var(--danger-line)] text-[var(--danger)] hover:bg-[var(--danger-bg)]",
    },
    size: { sm: "h-8 px-3", md: "h-10 px-4", icon: "size-9" },
  },
  defaultVariants: { variant: "secondary", size: "md" },
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
