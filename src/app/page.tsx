import { redirect } from "next/navigation";

// The dashboard is the app. Everything lives there except a single day's detail.
export default function RootPage() {
  redirect("/dashboard");
}
