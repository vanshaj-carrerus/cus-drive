"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type HeaderProps = {
  user: {
    name: string;
    role: "admin" | "user";
  };
};

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const initial = user.name.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-40 bg-surface">
      <div className="flex h-16 items-center gap-3 px-3 sm:px-4">
        <Link href="/documents" className="flex items-center gap-2 shrink-0 pl-1">
          <DriveMark />
          <span className="text-[22px] text-secondary tracking-tight">Drive</span>
        </Link>

        <div className="flex-1" />

        <nav className="flex items-center gap-1">
          <Link
            href="/documents"
            className={`rounded-full px-3 py-1.5 text-sm ${
              pathname === "/documents"
                ? "bg-primary/10 text-primary font-medium"
                : "text-secondary hover:bg-background"
            }`}
          >
            My Drive
          </Link>
          <Link
            href="/notes"
            className={`rounded-full px-3 py-1.5 text-sm ${
              pathname === "/notes"
                ? "bg-primary/10 text-primary font-medium"
                : "text-secondary hover:bg-background"
            }`}
          >
            Notes
          </Link>
          {user.role === "admin" && (
            <Link
              href="/users"
              className={`rounded-full px-3 py-1.5 text-sm ${
                pathname === "/users"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-secondary hover:bg-background"
              }`}
            >
              Users
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            className="rounded-full px-3 py-1.5 text-sm text-secondary hover:bg-background"
          >
            Logout
          </button>
          <span
            title={user.name}
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white"
          >
            {initial}
          </span>
        </nav>
      </div>
    </header>
  );
}

function DriveMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <path fill="#1a73e8" d="M8.3 3.5h7.4L22 15.2h-7.4z" />
      <path fill="#ea4335" d="M8.3 3.5 1.5 15.2h7.4L15.7 3.5z" />
      <path fill="#fbbc04" d="M4.7 20.5h14.6L22 15.2H7.4z" />
      <path fill="#34a853" d="M1.5 15.2 4.7 20.5h7.4L8.9 15.2z" />
    </svg>
  );
}
