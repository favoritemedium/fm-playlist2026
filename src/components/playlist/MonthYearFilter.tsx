"use client";

import { Calendar } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_FILTER_VALUE,
  type PlaylistFilterValue,
} from "@/lib/constants";

interface MonthYearFilterProps {
  availableYears: number[];
  availableMonths: number[];
  selectedYear: PlaylistFilterValue;
  selectedMonth: PlaylistFilterValue;
  onYearChange: (year: PlaylistFilterValue) => void;
  onMonthChange: (month: PlaylistFilterValue) => void;
}

function parseFilterValue(value: string): PlaylistFilterValue {
  return value === ALL_FILTER_VALUE ? ALL_FILTER_VALUE : Number(value);
}

export function MonthYearFilter({
  availableYears,
  availableMonths,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
}: MonthYearFilterProps) {
  const t = useTranslations("playlist.filter");
  const locale = useLocale();

  function getLocalizedMonthName(month: number): string {
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(
      new Date(2024, month - 1, 1)
    );
  }

  return (
    <div className="flex h-9 w-full items-center justify-between gap-1 rounded-xl border border-border/60 bg-neutral-100/80 px-2 sm:px-2.5 transition-colors hover:bg-neutral-100 sm:w-auto">
      <Calendar className="size-3.5 shrink-0 text-secondary" strokeWidth={2.5} />
      <div className="flex flex-1 items-center justify-center sm:justify-start">
        <Select
          value={selectedYear.toString()}
          onValueChange={(value) => onYearChange(parseFilterValue(value))}
        >
          <SelectTrigger
            aria-label={t("yearAriaLabel")}
            className="h-7 border-0 bg-transparent px-1 text-xs font-bold shadow-none hover:text-primary focus:ring-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER_VALUE}>{t("all")}</SelectItem>
            {availableYears.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="px-0.5 text-xs font-bold text-border">/</span>
        <Select
          value={selectedMonth.toString()}
          onValueChange={(value) => onMonthChange(parseFilterValue(value))}
        >
          <SelectTrigger
            aria-label={t("monthAriaLabel")}
            className="h-7 border-0 bg-transparent px-1 text-xs font-bold shadow-none hover:text-primary focus:ring-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER_VALUE}>{t("all")}</SelectItem>
            {availableMonths.map((month) => (
              <SelectItem key={month} value={month.toString()}>
                {getLocalizedMonthName(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
