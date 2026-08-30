"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getContributorAdmin } from "@/lib/admin-auth";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/constants";
import { saveContributorMapping } from "@/lib/contributor-reconciliation-db";

const mappingFormSchema = z.object({
  legacyName: z.string().trim().min(1).max(200),
  selectedUserId: z.string().trim().max(200).optional().default(""),
  typedEmail: z.string().trim().max(320).optional().default(""),
});

export async function saveContributorMappingAction(formData: FormData): Promise<never> {
  const admin = await getContributorAdmin();
  if (!admin) notFound();

  const parsed = mappingFormSchema.safeParse({
    legacyName: formData.get("legacyName"),
    selectedUserId: formData.get("selectedUserId"),
    typedEmail: formData.get("typedEmail"),
  });
  if (!parsed.success) redirect("/admin?error=invalid-form");

  const { legacyName, selectedUserId, typedEmail } = parsed.data;
  if (!selectedUserId && !typedEmail) redirect("/admin?error=missing-email");

  const email = typedEmail.toLocaleLowerCase("en-US");
  if (typedEmail) {
    const emailResult = z.string().email().safeParse(email);
    const domain = email.split("@").at(-1);
    if (!emailResult.success || domain !== ALLOWED_EMAIL_DOMAIN.toLocaleLowerCase("en-US")) {
      redirect("/admin?error=invalid-email");
    }
  }

  let updatedCount: number;
  try {
    updatedCount = await saveContributorMapping({
      legacyName,
      email,
      selectedUserId: typedEmail ? null : selectedUserId || null,
      adminEmail: admin.email,
    });
  } catch (error) {
    console.error("Failed to save contributor mapping:", error);
    redirect("/admin?error=save-failed");
  }

  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin?updated=${updatedCount}`);
}
