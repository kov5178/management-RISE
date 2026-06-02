export const BUSINESS_MONTHS = [
  { key: "marValue", month: 3, label: "3월" },
  { key: "aprValue", month: 4, label: "4월" },
  { key: "mayValue", month: 5, label: "5월" },
  { key: "junValue", month: 6, label: "6월" },
  { key: "julValue", month: 7, label: "7월" },
  { key: "augValue", month: 8, label: "8월" },
  { key: "sepValue", month: 9, label: "9월" },
  { key: "octValue", month: 10, label: "10월" },
  { key: "novValue", month: 11, label: "11월" },
  { key: "decValue", month: 12, label: "12월" },
  { key: "janValue", month: 1, label: "1월" },
  { key: "febValue", month: 2, label: "2월" },
] as const;

export type BusinessMonthKey = (typeof BUSINESS_MONTHS)[number]["key"];

export function getBusinessYearRange(year: number) {
  return {
    start: new Date(year, 2, 1),
    end: new Date(year + 1, 1, 28),
  };
}

export function getBusinessMonths() {
  return BUSINESS_MONTHS;
}

export function getBusinessYearFromDate(date: Date) {
  const month = date.getMonth() + 1;
  return month <= 2 ? date.getFullYear() - 1 : date.getFullYear();
}

export function formatBusinessPeriod(year: number) {
  return `${year}.03.01 ~ ${year + 1}.02.28`;
}

export function sumBusinessMonthValues(row: Partial<Record<BusinessMonthKey, number | null | undefined>>) {
  return BUSINESS_MONTHS.reduce((total, month) => total + Number(row[month.key] ?? 0), 0);
}
