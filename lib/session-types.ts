export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
};
