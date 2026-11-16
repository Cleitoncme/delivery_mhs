import { redirect } from "next/navigation";
import { CustomersView } from "@/features/admin/customers-view";
import { getAdminSession } from "@/lib/admin-auth";

export default async function AdminCustomersPage() {
  if (!(await getAdminSession())) redirect("/admin/login");
  return <CustomersView />;
}
