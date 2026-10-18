import { COUNTRIES, type AnalyticsUser } from "./data";

const HEADERS = ["name", "username", "email", "country", "status", "plan"];
const cell = (value: string) => `"${(/^[=+@-]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
export function usersCSV(users: readonly AnalyticsUser[]) { return [HEADERS.join(","), ...users.map(user => [user.name, user.username, user.email, user.country, user.status, user.plan].map(cell).join(","))].join("\r\n"); }
/** Small local-demo CSV adapter. Validate the entire import before changing rows. */
export function parseUsersCSV(text: string, period: string): AnalyticsUser[] {
  if (text.length > 500_000) throw new Error("Choose a CSV smaller than 500 KB.");
  const rows: string[][] = []; let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { value += '"'; index++; } else quoted = !quoted; }
    else if (!quoted && (char === "," || char === "\n")) { row.push(value.trim()); value = ""; if (char === "\n") { if (row.some(Boolean)) rows.push(row); row = []; } }
    else value += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quote.");
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  const header = rows.shift()?.map(value => value.replace(/^\uFEFF/, "").toLowerCase());
  if (!header || HEADERS.some(key => !header.includes(key))) throw new Error(`Required columns: ${HEADERS.join(", ")}.`);
  if (!rows.length || rows.length > 500) throw new Error("Choose a CSV with 1–500 users.");
  const emails = new Set<string>();
  return rows.map((cells, index) => {
    const get = (key: string) => cells[header.indexOf(key)] ?? "";
    const email = get("email"), status = get("status"), plan = get("plan");
    const country = COUNTRIES.find(item => item.id === get("country").toLowerCase() || item.name.toLowerCase() === get("country").toLowerCase())?.id;
    if (!get("name") || !get("username") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !country || !["Active", "Inactive"].includes(status) || !["Business Plan", "Pro Plan", "Free Plan"].includes(plan)) throw new Error(`Row ${index + 2}: check name, username, email, country, status and plan.`);
    if (emails.has(email.toLowerCase())) throw new Error(`Row ${index + 2}: duplicate email.`);
    emails.add(email.toLowerCase());
    return { id: `import-${index}`, name: get("name"), username: get("username"), email, country, status: status as AnalyticsUser["status"], plan: plan as AnalyticsUser["plan"], period };
  });
}
export function downloadCSV(name: string, text: string) { const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
