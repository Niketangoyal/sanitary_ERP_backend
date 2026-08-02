import dayjs from "dayjs";

export type PeriodPreset = "today" | "week" | "month" | "year" | "custom";

/** Resolves a named period (or explicit from/to for "custom") to a concrete [from, to] range. */
export const resolvePeriodRange = (
  period: PeriodPreset,
  customFrom?: string,
  customTo?: string,
): { from: Date; to: Date } => {
  const now = dayjs();

  switch (period) {
    case "today":
      return { from: now.startOf("day").toDate(), to: now.endOf("day").toDate() };
    case "week":
      return { from: now.startOf("week").toDate(), to: now.endOf("day").toDate() };
    case "month":
      return { from: now.startOf("month").toDate(), to: now.endOf("day").toDate() };
    case "year":
      return { from: now.startOf("year").toDate(), to: now.endOf("day").toDate() };
    case "custom":
    default:
      return {
        from: customFrom ? dayjs(customFrom).startOf("day").toDate() : now.startOf("month").toDate(),
        to: customTo ? dayjs(customTo).endOf("day").toDate() : now.endOf("day").toDate(),
      };
  }
};
