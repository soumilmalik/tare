"use client";

import { Search } from "lucide-react";
import { useAppNav } from "@/components/app-context";

/** Shared padding, title and search button for a tab screen. */
export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { openSearch } = useAppNav();
  return (
    <div className="mx-auto w-full max-w-md px-5 pt-5 pb-10">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-text-2">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={() => openSearch()}
          aria-label="Search"
          className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 active:bg-surface-2"
        >
          <Search className="size-5" />
        </button>
      </header>
      {children}
    </div>
  );
}
