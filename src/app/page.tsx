import Link from "next/link";
import Board from "@/components/Board";
import { requirePageAuth } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  await requirePageAuth();
  return (
    <main className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">▦</span>
          <h1>Dmdash</h1>
        </div>
        <nav className="app-nav">
          <Link href="/settings" className="nav-link">
            Settings
          </Link>
        </nav>
      </header>
      <Board />
    </main>
  );
}
