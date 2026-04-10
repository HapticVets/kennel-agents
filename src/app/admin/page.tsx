import { redirect } from "next/navigation";

export default function AdminDashboardPage() {
  // Middleware is the auth gate for hosted admin pages.
  redirect("/admin/operator");
}
