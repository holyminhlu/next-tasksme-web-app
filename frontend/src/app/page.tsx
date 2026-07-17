import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const hasRefreshCookie = Boolean(cookieStore.get("refreshToken")?.value);

  redirect(hasRefreshCookie ? "/dashboard" : "/login");
}
