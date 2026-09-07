import Header from "@/components/Header";
import UsersView from "@/components/UsersView";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/documents");
  }

  return (
    <>
      <Header user={user} />
      <UsersView currentUserId={user.id} />
    </>
  );
}
