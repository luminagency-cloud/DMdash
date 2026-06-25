import ProjectDetail from "@/components/ProjectDetail";
import { requirePageAuth } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default function ProjectPage({ params }: { params: { id: string } }) {
  requirePageAuth();
  return (
    <main className="app">
      <ProjectDetail projectId={params.id} />
    </main>
  );
}
