"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types";

export default function SettingsForm() {
  const router = useRouter();
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [backend, setBackend] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await api<{ settings: Settings; backend: string }>("/api/settings");
      setS(data.settings);
      setBackend(data.backend);
      setLoading(false);
    })();
  }, []);

  async function save() {
    const data = await api<{ settings: Settings }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(s),
    });
    setS(data.settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function logout() {
    await api("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  if (loading) return <div className="board-status">Loading…</div>;

  return (
    <div className="settings">
      <button className="link-back" onClick={() => router.push("/")}>
        ← Board
      </button>
      <h1>Settings</h1>

      <div className="setting-row">
        <label>Snooze length (days)</label>
        <p className="muted">How long a snoozed card stays parked before it bubbles back up.</p>
        <input
          type="number"
          min={1}
          max={365}
          value={s.snoozeDays}
          onChange={(e) => setS({ ...s, snoozeDays: Number(e.target.value) })}
        />
      </div>

      <div className="setting-row">
        <label>Turns &quot;warm&quot; after (days untouched)</label>
        <p className="muted">Cards start changing colour once you haven&apos;t touched them this long.</p>
        <input
          type="number"
          min={1}
          max={365}
          value={s.warmAfterDays}
          onChange={(e) => setS({ ...s, warmAfterDays: Number(e.target.value) })}
        />
      </div>

      <div className="setting-row">
        <label>Turns &quot;stale&quot; after (days untouched)</label>
        <p className="muted">Stale cards go red and show up in the top reminder banner.</p>
        <input
          type="number"
          min={1}
          max={365}
          value={s.staleAfterDays}
          onChange={(e) => setS({ ...s, staleAfterDays: Number(e.target.value) })}
        />
      </div>

      <div className="setting-row">
        <label>Today limit (WIP)</label>
        <p className="muted">Warn when more than this many cards pile up in Today. Leave blank to disable.</p>
        <input
          type="number"
          min={1}
          max={99}
          value={s.wipLimit ?? ""}
          onChange={(e) => setS({ ...s, wipLimit: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </div>

      <div className="settings-actions">
        <button className="btn btn-primary" onClick={save}>
          {saved ? "Saved ✓" : "Save settings"}
        </button>
        <button className="btn" onClick={logout}>
          Log out
        </button>
      </div>

      <p className="muted backend-note">
        Data backend: <strong>{backend}</strong>
        {backend === "mock" ? " (demo — set Airtable keys to persist for real)" : ""}
      </p>
    </div>
  );
}
