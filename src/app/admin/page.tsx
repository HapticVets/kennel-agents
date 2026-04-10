import { redirect } from "next/navigation";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin-auth";
import { IS_HOSTED_MODE } from "@/lib/config";

export default async function AdminDashboardPage({ cookies }: { cookies: any }) {
  // Read token from cookie
  const token = cookies.get?.(getAdminSessionCookieName())?.value;

  const sessionValid = await verifyAdminSessionToken(token, {
    requireSupabaseSession: IS_HOSTED_MODE,
  });

  if (!sessionValid) {
    // Redirect to login if not authenticated
    redirect("/admin/login");
  }

  // Otherwise, redirect to operator dashboard
  redirect("/admin/operator");
}