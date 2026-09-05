/** Converts an official HDB registration month into the date stored in Postgres. */
export function registrationMonthToDate(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(`Unexpected HDB registration month: ${month}`);
  }
  return `${month}-01`;
}
