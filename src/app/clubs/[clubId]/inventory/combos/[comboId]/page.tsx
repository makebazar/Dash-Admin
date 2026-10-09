import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCombo, getProducts, getCategories, getClubSettings } from "../../actions";
import { ComboDetailsClient } from "./ComboDetailsClient";
import { InventoryErrorState } from "../../_components/InventoryErrorState";

export default async function ComboDetailPage({
  params,
}: {
  params: Promise<{ clubId: string; comboId: string }>;
}) {
  const { clubId, comboId } = await params;
  const userId = (await cookies()).get("session_user_id")?.value;
  if (!userId) redirect("/login");

  const isNew = comboId === "new";

  let combo = null;
  let missingCombo = false;

  try {
    if (!isNew) {
      combo = await getCombo(clubId, comboId);
      if (!combo) {
        missingCombo = true;
      }
    }
  } catch (error: any) {
    const message = error?.message || "Не удалось загрузить данные комбо-набора";
    return <InventoryErrorState clubId={clubId} title="Ошибка комбо-набора" message={message} />;
  }

  if (!isNew && missingCombo) {
    return (
      <InventoryErrorState
        clubId={clubId}
        title="Комбо-набор не найден"
        message="Запрашиваемый комбо-набор не существует или был удален."
      />
    );
  }

  let products: any[] = [];
  let categories: any[] = [];
  let clubSettings: any = null;

  try {
    [products, categories, clubSettings] = await Promise.all([
      getProducts(clubId),
      getCategories(clubId),
      getClubSettings(clubId),
    ]);
  } catch (error: any) {
    const message = error?.message || "Не удалось загрузить товары склада";
    return <InventoryErrorState clubId={clubId} message={message} />;
  }

  const smartshellEnabled = Boolean(
    clubSettings?.inventory_settings?.smartshell_integration_enabled &&
      (clubSettings?.inventory_settings?.smartshell_api_key ||
        clubSettings?.inventory_settings?.smartshell_login)
  );

  return (
    <ComboDetailsClient
      clubId={clubId}
      userId={userId}
      initialCombo={combo}
      isNew={isNew}
      products={products}
      categories={categories}
      smartshellEnabled={smartshellEnabled}
    />
  );
}
