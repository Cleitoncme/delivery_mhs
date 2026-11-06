import { AdminView } from "@/features/admin/admin-view";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
export default async function AdminPage() {
  if (!(await getAdminSession())) redirect("/admin/login");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return <AdminView initialDate={`${value.year}-${value.month}-${value.day}`} />;
}
