import SettingsForm from "@/components/SettingsForm";
import { requirePageAuth } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePageAuth();
  return (
    <main className="app">
      <SettingsForm />
    </main>
  );
}
