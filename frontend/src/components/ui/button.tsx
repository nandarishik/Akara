import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "btn-press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[15px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white shadow-cta hover:bg-orange-600 hover:shadow-lg hover:scale-[1.02] focus-visible:ring-accent/50 active:scale-[0.98]",
        secondary:
          "bg-brand text-white shadow-brand hover:bg-brand-light focus-visible:ring-brand/50",
        default:
          "bg-brand text-white shadow-brand hover:bg-brand-light focus-visible:ring-brand/50",
        outline:
          "border-2 border-brand bg-transparent text-brand hover:bg-brand-dim focus-visible:ring-brand/30",
        ghost:
          "bg-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary focus-visible:ring-brand/20",
        destructive:
          "bg-danger text-white hover:bg-red-600 focus-visible:ring-danger/50",
        link: "text-brand underline-offset-4 hover:underline focus-visible:ring-brand/20 p-0 h-auto",
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "h-9 rounded-lg px-4 text-sm",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
