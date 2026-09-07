const ERRORS: Record<string, string> = {
  invalid: "Invalid user ID or password",
  required: "User ID and password are required",
  rate: "Too many login attempts. Try again later.",
};

export default function LoginForm({ errorCode }: { errorCode?: string }) {
  const error = errorCode ? ERRORS[errorCode] || "Unable to sign in. Try again." : "";

  return (
    <form action="/api/auth/login" method="post" className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm text-secondary mb-1.5">
          User ID
        </label>
        <input
          id="email"
          name="email"
          type="text"
          autoComplete="username"
          className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary"
          required
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-secondary mb-1.5">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary"
          required
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" className="w-full rounded-full bg-primary py-2.5 text-sm text-white">
        Login
      </button>
    </form>
  );
}
