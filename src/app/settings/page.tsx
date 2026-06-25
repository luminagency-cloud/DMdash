import SettingsForm from "@/components/SettingsForm";
import { requirePageAuth } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  requirePageAuth();
  return (
    <main className="app">
      <SettingsForm />
    </main>
  );
}
