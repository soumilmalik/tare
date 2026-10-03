"use client";

import { formatLongDate } from "@/lib/dates";
import { useLogicalDate } from "@/lib/use-logical-date";
import { Screen } from "./screen";

export function HomeScreen() {
  const today = useLogicalDate();

  return (
    <Screen title="Today">
      <p className="mt-1 h-5 text-sm text-text-2">{today && formatLongDate(today)}</p>
      <p className="mt-16 text-center text-sm text-text-3">Nothing logged yet</p>
    </Screen>
  );
}
