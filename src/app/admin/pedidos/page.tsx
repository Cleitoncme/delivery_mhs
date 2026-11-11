import { redirect } from "next/navigation";
import { AdminView } from "@/features/admin/admin-view";
import { getAdminSession } from "@/lib/admin-auth";
import { todayInShopTimeZone } from "@/lib/shop-date";

export default async function AdminOrdersPage() {
  if (!(await getAdminSession())) redirect("/admin/login");
  return <AdminView initialDate={todayInShopTimeZone()} />;
}
