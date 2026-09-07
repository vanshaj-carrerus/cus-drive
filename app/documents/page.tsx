import DriveView from "@/components/DriveView";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <Header user={user} />
      <DriveView />
    </>
  );
}
