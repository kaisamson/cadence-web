// src/app/(protected)/layout.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("cadence_auth");

  if (auth?.value !== "1") {
    redirect("/login?from=/");
  }

  return <>{children}</>;
}
