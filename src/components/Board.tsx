"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/client";
import { LANES, LANE_LABELS, type Lane, type ProjectView, type Settings } from "@/lib/types";

type ItemMap = Record<Lane, string[]>;

function emptyMap(): ItemMap {
  return { today: [], next: [], unlabeled: [], snooze: [] };
}

export default function Board() {
  const router = useRouter();
  const [byId, setById] = useState<Record<string, ProjectView>>({});
  const [items, setItems] = useState<ItemMap>(emptyMap());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [backend, setBackend] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addingLane, setAddingLane] = useState<Lane | null>(null);
  const [newName, setNewName] = useState("");
  const [focus, setFocus] = useState(false);
  const snapshot = useRef<Record<string, { lane: Lane; index: number }>>({});
  const suppressClick = useRef(0);

  function openProject(id: string) {
    if (Date.now() < suppressClick.current) return;
    router.push(`/project/${id}`);
  }

  // Mouse uses a small drag threshold; touch uses a long-press so vertical
  // scrolling on the phone still works inside the bands.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function load() {
    try {
      setError(null);
      const data = await api<{ projects: ProjectView[]; settings: Settings; backend: string }>("/api/projects");
      const map = emptyMap();
      const dict: Record<string, ProjectView> = {};
      for (const p of [...data.projects].sort((a, b) => a.position - b.position)) {
        map[p.lane].push(p.id);
        dict[p.id] = p;
      }
      setItems(map);
      setById(dict);
      setSettings(data.settings);
      setBackend(data.backend);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-pull whenever the tab regains focus / becomes visible, so changes made
  // elsewhere (a project added in Airtable, another device) show without a reload.
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function findContainer(id: string): Lane | undefined {
    if ((LANES as string[]).includes(id)) return id as Lane;
    return LANES.find((l) => items[l].includes(id));
  }

  function takeSnapshot() {
    const snap: Record<string, { lane: Lane; index: number }> = {};
    for (const l of LANES) items[l].forEach((id, index) => (snap[id] = { lane: l, index }));
    snapshot.current = snap;
  }

  function onDragStart(e: DragStartEvent) {
    takeSnapshot();
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = findContainer(activeId);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const fromItems = [...prev[from]];
      const toItems = [...prev[to]];
      const fromIdx = fromItems.indexOf(activeId);
      if (fromIdx < 0) return prev;
      fromItems.splice(fromIdx, 1);
      const overIdx = toItems.indexOf(overId);
      const insertAt = overIdx >= 0 ? overIdx : toItems.length;
      toItems.splice(insertAt, 0, activeId);
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);
    suppressClick.current = Date.now() + 250;

    let final = items;
    if (overId) {
      const from = findContainer(activeId);
      const to = findContainer(overId);
      if (from && to && from === to) {
        const arr = items[from];
        const oldIndex = arr.indexOf(activeId);
        const newIndex = arr.indexOf(overId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          final = { ...items, [from]: arrayMove(arr, oldIndex, newIndex) };
        }
      }
    }
    setItems(final);
    persist(activeId, final);
  }

  async function persist(movedId: string, map: ItemMap) {
    if (!settings) return;
    const changed: { id: string; lane: Lane; position: number }[] = [];
    for (const l of LANES) {
      map[l].forEach((id, index) => {
        const snap = snapshot.current[id];
        if (!snap || snap.lane !== l || snap.index !== index) {
          changed.push({ id, lane: l, position: index });
        }
      });
    }
    if (changed.length === 0) return;

    const movedTo = LANES.find((l) => map[l].includes(movedId));
    let snoozeUntil: string | null = null;
    if (movedTo === "snooze") {
      snoozeUntil = new Date(Date.now() + settings.snoozeDays * 86400000).toISOString();
    }

    setById((prev) => {
      const moved = prev[movedId];
      if (!moved) return prev;
      const updated: ProjectView = {
        ...moved,
        lane: movedTo || moved.lane,
        lastTouched: new Date().toISOString(),
        daysUntouched: 0,
        snoozeUntil: movedTo === "snooze" ? snoozeUntil : null,
        agingStage: movedTo === "snooze" ? "snoozed" : "fresh",
        woke: false,
      };
      return { ...prev, [movedId]: updated };
    });

    try {
      await api("/api/projects/reorder", {
        method: "POST",
        body: JSON.stringify({ movedId, items: changed, snoozeUntil }),
      });
    } catch (e: any) {
      setError(e.message || "Save failed");
      load();
    }
  }

  async function addProject(lane: Lane) {
    const name = newName.trim();
    if (!name) {
      setAddingLane(null);
      return;
    }
    try {
      const { project } = await api<{ project: ProjectView }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, lane }),
      });
      setById((p) => ({ ...p, [project.id]: project }));
      setItems((p) => ({ ...p, [lane]: [...p[lane], project.id] }));
      await load(); // reconcile with the server so the new card always renders
    } catch (e: any) {
      setError(e.message || "Could not add");
    } finally {
      setNewName("");
      setAddingLane(null);
    }
  }

  const staleList = useMemo(
    () => Object.values(byId).filter((p) => p.agingStage === "stale"),
    [byId]
  );
  const wipExceeded = !!settings && settings.wipLimit != null && items.today.length > settings.wipLimit;
  const lanesToShow: Lane[] = focus ? ["today"] : LANES;

  if (loading) {
    return <div className="board-status">Loading your board…</div>;
  }

  return (
    <>
      <div className="toolbar">
        <button className={`focus-btn ${focus ? "on" : ""}`} onClick={() => setFocus((f) => !f)}>
          {focus ? "← Exit focus" : "◎ Focus"}
        </button>
        <span className="toolbar-hint">↑ Up = more important · drag between bands</span>
      </div>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)}>
          {error} · tap to dismiss
        </div>
      )}

      {(staleList.length > 0 || wipExceeded) && (
        <div className="banner banner-attention">
          {wipExceeded && (
            <span className="banner-chip wip">
              {items.today.length} in Now — over your limit of {settings?.wipLimit}. Pick fewer.
            </span>
          )}
          {staleList.length > 0 && (
            <span className="banner-line">
              <strong>Haven&apos;t touched in a while:</strong>{" "}
              {staleList.slice(0, 6).map((p) => (
                <button key={p.id} className="banner-chip stale" onClick={() => router.push(`/project/${p.id}`)}>
                  {p.name} · {p.daysUntouched}d
                </button>
              ))}
            </span>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="board">
          {lanesToShow.map((lane) => (
            <LaneColumn
              key={lane}
              lane={lane}
              itemIds={items[lane]}
              byId={byId}
              isAdding={addingLane === lane}
              newName={newName}
              onStartAdd={() => {
                setAddingLane(lane);
                setNewName("");
              }}
              onChangeName={setNewName}
              onSubmitAdd={() => addProject(lane)}
              onCancelAdd={() => setAddingLane(null)}
              onOpen={openProject}
              wipLimit={lane === "today" ? settings?.wipLimit ?? null : null}
            />
          ))}
        </div>

        <DragOverlay>
          {activeId && byId[activeId] ? <Card project={byId[activeId]} dragging onOpen={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      {backend === "mock" && (
        <div className="demo-badge">Demo data (in-memory) — set Airtable keys to go live</div>
      )}
    </>
  );
}

function LaneColumn({
  lane,
  itemIds,
  byId,
  isAdding,
  newName,
  onStartAdd,
  onChangeName,
  onSubmitAdd,
  onCancelAdd,
  onOpen,
  wipLimit,
}: {
  lane: Lane;
  itemIds: string[];
  byId: Record<string, ProjectView>;
  isAdding: boolean;
  newName: string;
  onStartAdd: () => void;
  onChangeName: (v: string) => void;
  onSubmitAdd: () => void;
  onCancelAdd: () => void;
  onOpen: (id: string) => void;
  wipLimit: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: lane });
  return (
    <section className={`lane lane-${lane} ${isOver ? "lane-over" : ""}`}>
      <header className="lane-head">
        <h2>{LANE_LABELS[lane]}</h2>
        <div className="lane-head-right">
          <span className="lane-count">
            {itemIds.length}
            {wipLimit != null ? ` / ${wipLimit}` : ""}
          </span>
          <button className="lane-add" aria-label={`Add to ${LANE_LABELS[lane]}`} onClick={onStartAdd}>
            +
          </button>
        </div>
      </header>

      <div ref={setNodeRef} className="lane-body">
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          {itemIds.map((id) => (
            <SortableCard key={id} id={id} project={byId[id]} onOpen={onOpen} />
          ))}
        </SortableContext>

        {isAdding && (
          <div className="add-card">
            <input
              autoFocus
              value={newName}
              placeholder="Project name…"
              onChange={(e) => onChangeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmitAdd();
                if (e.key === "Escape") onCancelAdd();
              }}
              onBlur={onSubmitAdd}
            />
          </div>
        )}

        {itemIds.length === 0 && !isAdding && <div className="lane-empty">Drop here</div>}
      </div>
    </section>
  );
}

function SortableCard({
  id,
  project,
  onOpen,
}: {
  id: string;
  project: ProjectView;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="card-wrap">
      <Card project={project} onOpen={onOpen} />
    </div>
  );
}

function Card({
  project,
  onOpen,
  dragging,
}: {
  project: ProjectView;
  onOpen: (id: string) => void;
  dragging?: boolean;
}) {
  const wake =
    project.snoozeUntil && project.agingStage === "snoozed"
      ? Math.ceil((new Date(project.snoozeUntil).getTime() - Date.now()) / 86400000)
      : null;
  return (
    <article
      className={`card aging-${project.agingStage} ${dragging ? "card-dragging" : ""}`}
      data-lane={project.lane}
      onClick={() => onOpen(project.id)}
    >
      <div className="card-strip" />
      <div className="card-main">
        <h3 className="card-title">{project.name}</h3>
        <div className="card-meta">
          {project.repos.length > 0 && (
            <span className="meta-pill repo" title={project.repos.join(", ")}>
              ⎇ {project.repos.length} repo{project.repos.length > 1 ? "s" : ""}
            </span>
          )}
          {wake != null ? (
            <span className="meta-pill snoozed">wakes in {Math.max(0, wake)}d</span>
          ) : (
            <span className={`meta-pill age age-${project.agingStage}`}>
              {project.daysUntouched === 0 ? "today" : `${project.daysUntouched}d untouched`}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
