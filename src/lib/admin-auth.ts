import "server-only";

import { getCurrentAppAuth, type AppUser } from "@/lib/auth";
import { isContributorAdminEmail } from "@/lib/admin-constants";

export async function getContributorAdmin(): Promise<AppUser | null> {
  const auth = await getCurrentAppAuth();
  if (auth.status !== "authenticated") return null;
  return isContributorAdminEmail(auth.user.email) ? auth.user : null;
}
