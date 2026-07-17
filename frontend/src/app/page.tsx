import { redirect } from "next/navigation";

// The refresh cookie is scoped to the backend auth path and invisible here,
// so we cannot detect auth server-side. Send everyone to the dashboard;
// AuthGate redirects unauthenticated visitors to /login.
export default function Home() {
  redirect("/dashboard");
}
