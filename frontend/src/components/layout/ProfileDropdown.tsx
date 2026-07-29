import { CreditCard, FileText, LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getUserAvatarUrl } from "@/lib/avatar";

export interface ProfileDropdownData {
  name: string;
  email: string;
  avatarUrl: string;
  subscription?: string;
}

interface ProfileDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  data: ProfileDropdownData;
  onSignOut: () => void;
  compact?: boolean;
}

export default function ProfileDropdown({
  data,
  onSignOut,
  compact = false,
  className,
  ...props
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const menuItems = [
    {
      label: "Settings",
      href: "/settings",
      icon: <Settings className="h-4 w-4" />,
    },
    {
      label: "Billing",
      href: "/billing",
      icon: <CreditCard className="h-4 w-4" />,
      value: data.subscription,
    },
    {
      label: "Terms & Policies",
      href: "/terms",
      icon: <FileText className="h-4 w-4" />,
      external: true,
    },
  ];

  return (
    <div className={cn("relative w-full", className)} {...props}>
      <DropdownMenu onOpenChange={setIsOpen}>
        <div className="group relative">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#111]/80 p-3 transition-all duration-200 hover:border-white/20 hover:bg-[#111] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#03B3C3]/40",
                compact && "p-2 gap-2 rounded-xl"
              )}
            >
              {!compact && (
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium leading-tight text-white">
                    {data.name}
                  </div>
                  <div className="truncate text-xs leading-tight text-white/50">
                    {data.email}
                  </div>
                </div>
              )}
              <div className="relative shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#D856BF] via-[#03B3C3] to-[#38bdf8] p-0.5">
                  <div className="h-full w-full overflow-hidden rounded-full bg-[#0a0a0a]">
                    <img
                      alt={data.name}
                      className="h-full w-full rounded-full object-cover"
                      src={data.avatarUrl || getUserAvatarUrl(null, data.email)}
                    />
                  </div>
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>

          {!compact && (
            <div
              className={cn(
                "absolute top-1/2 -right-3 -translate-y-1/2 transition-all duration-200",
                isOpen ? "opacity-100" : "opacity-60 group-hover:opacity-100"
              )}
            >
              <svg
                aria-hidden="true"
                className={cn(
                  "transition-all duration-200",
                  isOpen
                    ? "scale-110 text-[#03B3C3]"
                    : "text-white/40 group-hover:text-white/60"
                )}
                fill="none"
                height="24"
                viewBox="0 0 12 24"
                width="12"
              >
                <path
                  d="M2 4C6 8 6 16 2 20"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          )}

          <DropdownMenuContent align="end" className="w-64" sideOffset={4}>
            <div className="space-y-1">
              {menuItems.map((item) => (
                <DropdownMenuItem asChild key={item.label}>
                  <Link
                    to={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className="group flex w-full cursor-pointer items-center rounded-xl border border-transparent p-3 transition-all duration-200 hover:border-white/10 hover:bg-white/5"
                  >
                    <div className="flex flex-1 items-center gap-2">
                      {item.icon}
                      <span className="whitespace-nowrap text-sm font-medium text-white/90">
                        {item.label}
                      </span>
                    </div>
                    {item.value && (
                      <span className="ml-auto shrink-0 rounded-md border border-[#03B3C3]/20 bg-[#03B3C3]/10 px-2 py-1 text-xs font-medium uppercase tracking-tight text-[#03B3C3]">
                        {item.value}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>

            <DropdownMenuSeparator className="my-3" />

            <DropdownMenuItem asChild>
              <button
                type="button"
                onClick={onSignOut}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-red-500/10 p-3 transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/20"
              >
                <LogOut className="h-4 w-4 text-red-400 group-hover:text-red-300" />
                <span className="text-sm font-medium text-red-400 group-hover:text-red-300">
                  Sign Out
                </span>
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </div>
      </DropdownMenu>
    </div>
  );
}
