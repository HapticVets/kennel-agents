import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin-auth";
import { IS_HOSTED_MODE } from "@/lib/config";

export default async function AdminDashboardPage() {
  // Read token from cookie
  const token = cookies().get(getAdminSessionCookieName())?.value;

  const sessionValid = await verifyAdminSessionToken(token, {
    requireSupabaseSession: IS_HOSTED_MODE,
  });

  if (!sessionValid) {
    // Redirect to login if not authenticated
    redirect("/admin/login");
    return; // <-- exit here to prevent further code execution
  }

  // Redirect to operator dashboard if authenticated
  redirect("/admin/operator");
}