/**
 * Resolve inline validation copy for onboarding education/work rows.
 * Row-level date errors (_row) surface on start_date and end_date fields.
 */
export function onboardListFieldErr(rowMap, index, field) {
  const row = rowMap[index];
  if (!row) return "";
  if (row[field]) return row[field];
  if ((field === "start_date" || field === "end_date") && row._row) return row._row;
  return "";
}
