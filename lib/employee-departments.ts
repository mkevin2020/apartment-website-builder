// Department configuration — each department gets its own dashboard route.
// The login flow routes an employee to their department's dashboard.

export type DepartmentSlug =
  | "it"
  | "maintenance"
  | "security"
  | "administration"
  | "cleaning"
  | "reception"

export interface DepartmentConfig {
  slug: DepartmentSlug
  /** Department value as stored on the employee record */
  name: string
  title: string
  subtitle: string
  /** Tailwind accent (used for headers/badges) */
  accent: string // e.g. "indigo"
}

export const DEPARTMENTS: Record<DepartmentSlug, DepartmentConfig> = {
  it: {
    slug: "it",
    name: "IT",
    title: "IT Department",
    subtitle: "System overview, accounts, and platform health",
    accent: "violet",
  },
  maintenance: {
    slug: "maintenance",
    name: "Maintenance",
    title: "Maintenance Department",
    subtitle: "Handle and resolve maintenance requests",
    accent: "amber",
  },
  security: {
    slug: "security",
    name: "Security",
    title: "Security Department",
    subtitle: "Occupancy, access, and check-in/out activity",
    accent: "blue",
  },
  administration: {
    slug: "administration",
    name: "Administration",
    title: "Administration Department",
    subtitle: "Bookings, tenants, and client feedback",
    accent: "emerald",
  },
  cleaning: {
    slug: "cleaning",
    name: "Cleaning",
    title: "Cleaning Department",
    subtitle: "Apartment cleaning schedule and checklist",
    accent: "cyan",
  },
  reception: {
    slug: "reception",
    name: "Reception",
    title: "Reception Desk",
    subtitle: "Scan or enter a receipt code to verify tickets",
    accent: "blue",
  },
}

// Map a stored department value (any casing) to its slug. Defaults to administration.
export function departmentToSlug(department?: string | null): DepartmentSlug {
  const d = (department || "").trim().toLowerCase()
  if (d.startsWith("it")) return "it"
  if (d.startsWith("maint")) return "maintenance"
  if (d.startsWith("secur")) return "security"
  if (d.startsWith("clean")) return "cleaning"
  if (d.startsWith("recep")) return "reception"
  if (d.startsWith("admin")) return "administration"
  return "administration"
}

export function dashboardPathFor(department?: string | null): string {
  return `/employee/${departmentToSlug(department)}`
}
