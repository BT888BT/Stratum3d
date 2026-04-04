import type { Metadata } from "next";
import { isAdminAuthed } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // #1: Real DB-backed session check — prevents fake cookie bypass
  const authed = await isAdminAuthed();
  if (!authed) {
    redirect("/login");
  }

  return <>{children}</>;
}
