import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; password?: string }>;
}) {
  const params = await searchParams;

  if (params.email || params.password) {
    redirect(params.error ? `/login?error=${params.error}` : "/login");
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-border">
        <div className="flex justify-center">
          <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden>
            <path fill="#1a73e8" d="M8.3 3.5h7.4L22 15.2h-7.4z" />
            <path fill="#ea4335" d="M8.3 3.5 1.5 15.2h7.4L15.7 3.5z" />
            <path fill="#fbbc04" d="M4.7 20.5h14.6L22 15.2H7.4z" />
            <path fill="#34a853" d="M1.5 15.2 4.7 20.5h7.4L8.9 15.2z" />
          </svg>
        </div>
        <h1 className="mt-3 text-center text-xl tracking-tight text-secondary">Drive</h1>
        <p className="mt-1 text-center text-sm text-secondary">
          Sign in to open department files
        </p>
        <LoginForm errorCode={params.error} />
      </div>
    </main>
  );
}
