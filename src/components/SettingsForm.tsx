"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function SettingsForm() {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    api<{ configured: boolean }>("/api/trello?status=1")
      .then((data) => setConfigured(data.configured))
      .catch(() => setConfigured(false));
  }, []);

  async function logout() {
    await api("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div className="settings">
      <button className="link-back" onClick={() => router.push("/")}>← Board</button>
      <h1>Settings</h1>
      <section className="panel setting-section">
        <h2>Trello connection</h2>
        <p className={configured ? "connection-good" : "error"}>
          {configured === null ? "Checking…" : configured ? "Connected through server environment variables." : "Not configured."}
        </p>
        <p className="muted">Set <code>TRELLO_API_KEY</code> and <code>TRELLO_TOKEN</code> in the deployment environment. Credentials never reach the browser.</p>
      </section>
      <section className="panel setting-section">
        <h2>Standard board workflow</h2>
        <ol className="workflow-list"><li>To Do</li><li>Next Up</li><li>In Progress</li><li>Waiting</li><li>Done</li></ol>
        <p className="muted">Dmdash also recognizes Backlog, Next, Doing, Blocked, Complete and Completed as aliases.</p>
      </section>
      <div className="settings-actions"><button className="btn" onClick={logout}>Log out</button></div>
    </div>
  );
}
