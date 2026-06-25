import Link from "next/link";
import Board from "@/components/Board";
import { requirePageAuth } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default function BoardPage() {
  requirePageAuth();
  return (
    <main className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">▦</span>
          <h1>Command Board</h1>
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
