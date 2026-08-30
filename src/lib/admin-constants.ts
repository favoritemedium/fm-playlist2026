export const CONTRIBUTOR_ADMIN_EMAIL = "chanaka@favoritemedium.com";

export function isContributorAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLocaleLowerCase("en-US") === CONTRIBUTOR_ADMIN_EMAIL;
}
