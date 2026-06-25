"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Wrong password");
      }
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Login failed");
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <h1>Command Board</h1>
        <p className="muted">Enter your password to continue.</p>
        <input
          type="password"
          autoFocus
          value={password}
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="login-error">{error}</div>}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
