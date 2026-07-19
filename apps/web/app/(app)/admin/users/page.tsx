import { notFound } from "next/navigation";

import { ensureCurrentUser } from "@/lib/users";

import { UsersTab } from "../_components/users-tab";

export default async function AdminUsersPage() {
  const user = await ensureCurrentUser();
  if (!user || user.role !== "admin") notFound();
  return <UsersTab selfId={user.id} />;
}
