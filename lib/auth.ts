import type { AuthRole } from "@/types/auth";

export function getDashboardRouteForRole(role: AuthRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "AGENT":
      return "/crm";
    case "CASHIER":
    default:
      return "/cashier";
  }
}
