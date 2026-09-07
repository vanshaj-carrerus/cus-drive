"use client";

import { formatDate } from "@/lib/format";
import { FormEvent, useEffect, useState } from "react";

type PortalUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "disabled";
  created_at: string;
};

export default function UsersView({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });

  async function load() {
    setError("");
    const response = await fetch("/api/users");
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not load users");
      return;
    }
    setUsers(data.users);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Could not add user");
      return;
    }
    setUsers((current) => [...current, data.user]);
    setForm({ name: "", email: "", password: "", role: "user" });
    setShowForm(false);
  }

  async function setStatus(id: string, status: "active" | "disabled") {
    setError("");
    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not update user");
      return;
    }
    setUsers((current) => current.map((item) => (item.id === id ? data.user : item)));
  }

  async function onReset(event: FormEvent, id: string) {
    event.preventDefault();
    if (resetPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not reset password");
      return;
    }
    setResetId(null);
    setResetPassword("");
  }

  async function onRemove(id: string, name: string) {
    if (!window.confirm(`Remove ${name}? They will no longer be able to sign in.`)) {
      return;
    }
    const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not remove user");
      return;
    }
    setUsers((current) => current.filter((item) => item.id !== id));
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-medium text-foreground">Users</h1>
        <button
          type="button"
          onClick={() => setShowForm((open) => !open)}
          className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-white"
        >
          + Add user
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mt-8 max-w-md space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-border">
          <div>
            <label className="block text-sm text-secondary mb-1.5" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-secondary mb-1.5" htmlFor="user-id">
              User ID / Email
            </label>
            <input
              id="user-id"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-secondary mb-1.5" htmlFor="temp-password">
              Temporary password
            </label>
            <input
              id="temp-password"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-secondary mb-1.5" htmlFor="role">
              Role
            </label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-white px-4 py-2 text-sm disabled:opacity-60 rounded-full"
          >
            {pending ? "Adding..." : "Add user"}
          </button>
        </form>
      )}

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="mt-10 text-sm text-secondary">Loading users...</p>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-border md:hidden">
            {users.map((item) => (
              <li key={item.id} className="py-4">
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-sm text-secondary">
                  {item.email} · {item.role} · {item.status}
                </p>
                <UserActions
                  item={item}
                  currentUserId={currentUserId}
                  resetId={resetId}
                  resetPassword={resetPassword}
                  setResetId={setResetId}
                  setResetPassword={setResetPassword}
                  onReset={onReset}
                  setStatus={setStatus}
                  onRemove={onRemove}
                />
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-secondary">
                  <th className="py-3 font-medium">Name</th>
                  <th className="py-3 font-medium">User ID</th>
                  <th className="py-3 font-medium">Role</th>
                  <th className="py-3 font-medium">Status</th>
                  <th className="py-3 font-medium">Added</th>
                  <th className="py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id} className="border-b border-border align-top">
                    <td className="py-3 pr-4">{item.name}</td>
                    <td className="py-3 pr-4">{item.email}</td>
                    <td className="py-3 pr-4 capitalize">{item.role}</td>
                    <td className="py-3 pr-4 capitalize">{item.status}</td>
                    <td className="py-3 pr-4 text-secondary">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="py-3">
                      <UserActions
                        item={item}
                        currentUserId={currentUserId}
                        resetId={resetId}
                        resetPassword={resetPassword}
                        setResetId={setResetId}
                        setResetPassword={setResetPassword}
                        onReset={onReset}
                        setStatus={setStatus}
                        onRemove={onRemove}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function UserActions({
  item,
  currentUserId,
  resetId,
  resetPassword,
  setResetId,
  setResetPassword,
  onReset,
  setStatus,
  onRemove,
}: {
  item: PortalUser;
  currentUserId: string;
  resetId: string | null;
  resetPassword: string;
  setResetId: (id: string | null) => void;
  setResetPassword: (value: string) => void;
  onReset: (event: FormEvent, id: string) => void;
  setStatus: (id: string, status: "active" | "disabled") => void;
  onRemove: (id: string, name: string) => void;
}) {
  if (item.id === currentUserId) {
    return <span className="text-sm text-secondary">—</span>;
  }

  return (
    <div className="mt-2 md:mt-0 space-y-2">
      <div className="flex flex-wrap gap-3 text-sm">
        {item.status === "active" ? (
          <button
            type="button"
            onClick={() => setStatus(item.id, "disabled")}
            className="text-secondary hover:text-primary"
          >
            Disable
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStatus(item.id, "active")}
            className="text-secondary hover:text-primary"
          >
            Enable
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setResetId(resetId === item.id ? null : item.id);
            setResetPassword("");
          }}
          className="text-secondary hover:text-primary"
        >
          Reset password
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.id, item.name)}
          className="text-secondary hover:text-red-700"
        >
          Remove
        </button>
      </div>
      {resetId === item.id ? (
        <form
          onSubmit={(event) => onReset(event, item.id)}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="New temporary password"
            className="border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
            minLength={8}
            required
          />
          <button type="submit" className="bg-primary text-white px-3 py-1.5 text-sm">
            Save
          </button>
        </form>
      ) : null}
    </div>
  );
}
