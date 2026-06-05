import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/club-api-access";
import { PageShell } from "@/components/layout/PageShell";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function ClubAnalyticsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  
  // 1. Session verification
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) {
    redirect("/login");
  }

  // 2. Permission enforcement: requires view shifts rights
  try {
    await requireModuleAccess(clubId, "shifts", "view");
  } catch (error) {
    redirect(`/clubs/${clubId}`);
  }

  return (
    <PageShell maxWidth="5xl">
      <AnalyticsClient clubId={clubId} />
    </PageShell>
  );
}
