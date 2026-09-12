import Header from "@/components/Header";
import NotesView from "@/components/NotesView";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Department Notes",
  description: "Keep, organize, and manage department notes and reminders",
};

export default async function NotesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <Header user={user} />
      <NotesView user={user} />
    </>
  );
}
