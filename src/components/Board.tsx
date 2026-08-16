"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/client";
import { ACTIVE_STAGES, WORKFLOW_LABELS, type CommandBoardPayload, type TrelloBoard, type TrelloWorkCard, type WorkflowStage } from "@/lib/types";

type CardMap = Record<WorkflowStage, TrelloWorkCard[]>;
const emptyCards = (): CardMap => ({ todo: [], next: [], progress: [], waiting: [], done: [] });
const ageInDays = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

function labelColor(color: string | null) {
  const colors: Record<string, string> = { red: "#f85149", orange: "#db6d28", yellow: "#d29922", green: "#2ea043", blue: "#4c8dff", purple: "#a371f7", pink: "#db61a2", lime: "#82b440", sky: "#58a6ff", black: "#6e7681" };
  return colors[color || ""] || "#6e7681";
}

export default function Board() {
  const [payload, setPayload] = useState<CommandBoardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("all");
  const [labelId, setLabelId] = useState("all");
  const [query, setQuery] = useState("");
  const [mobileStage, setMobileStage] = useState<WorkflowStage>("next");
  const [showCompleted, setShowCompleted] = useState(false);
  const [editing, setEditing] = useState<TrelloWorkCard | null>(null);
  const [addingStage, setAddingStage] = useState<WorkflowStage | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const initialLoad = useRef(true);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 7 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));

  const load = useCallback(async () => {
    try {
      if (!initialLoad.current) setRefreshing(true);
      setPayload(await api<CommandBoardPayload>("/api/trello"));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Trello");
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialLoad.current = false;
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refreshIfVisible = () => { if (!document.hidden) void load(); };
    const interval = window.setInterval(refreshIfVisible, 90_000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refreshIfVisible); document.removeEventListener("visibilitychange", refreshIfVisible); };
  }, [load]);

  const labels = useMemo(() => {
    const map = new Map<string, TrelloWorkCard["labels"][number]>();
    for (const card of payload?.cards || []) for (const label of card.labels) map.set(label.id, label);
    return [...map.values()].sort((a, b) => (a.name || a.color || "").localeCompare(b.name || b.color || ""));
  }, [payload]);

  const cards = useMemo(() => {
    const grouped = emptyCards();
    const needle = query.trim().toLowerCase();
    for (const card of payload?.cards || []) {
      if (projectId !== "all" && card.boardId !== projectId) continue;
      if (labelId !== "all" && !card.labels.some((label) => label.id === labelId)) continue;
      if (needle && !`${card.name}\n${card.description}\n${card.boardName}`.toLowerCase().includes(needle)) continue;
      grouped[card.stage].push(card);
    }
    for (const stage of Object.keys(grouped) as WorkflowStage[]) grouped[stage].sort((a, b) => a.position - b.position);
    return grouped;
  }, [labelId, payload, projectId, query]);

  const cardById = useMemo(() => new Map((payload?.cards || []).map((card) => [card.id, card])), [payload]);
  const stages = showCompleted ? ["done" as const] : ACTIVE_STAGES;

  async function moveCard(card: TrelloWorkCard, stage: WorkflowStage) {
    if (!payload || stage === card.stage) return;
    const board = payload.boards.find((item) => item.id === card.boardId);
    const listId = board?.lists[stage];
    if (!listId) { setError(`${board?.name || card.boardName} does not have a ${WORKFLOW_LABELS[stage]} list.`); return; }
    setPayload((current) => current ? { ...current, cards: current.cards.map((item) => item.id === card.id ? { ...item, stage, listId } : item) } : current);
    try {
      await api("/api/trello", { method: "PATCH", body: JSON.stringify({ cardId: card.id, listId, position: "top" }) });
      await load();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Move failed");
      await load();
    }
  }

  function onDragStart(event: DragStartEvent) { setActiveId(String(event.active.id)); }
  async function reorderCard(card: TrelloWorkCard, overCard: TrelloWorkCard) {
    if (!payload || card.id === overCard.id || card.boardId !== overCard.boardId || card.stage !== overCard.stage) return;
    const boardCards = payload.cards.filter((item) => item.boardId === card.boardId && item.stage === card.stage).sort((a, b) => a.position - b.position);
    const from = boardCards.findIndex((item) => item.id === card.id);
    const over = boardCards.findIndex((item) => item.id === overCard.id);
    if (from < 0 || over < 0 || from === over) return;
    const without = boardCards.filter((item) => item.id !== card.id);
    const target = without.findIndex((item) => item.id === overCard.id) + (from < over ? 1 : 0);
    const before = without[target - 1]?.position;
    const after = without[target]?.position;
    const position = before === undefined ? Math.max(1, (after || 16384) / 2) : after === undefined ? before + 16384 : (before + after) / 2;
    setPayload((current) => current ? { ...current, cards: current.cards.map((item) => item.id === card.id ? { ...item, position } : item) } : current);
    try { await api("/api/trello", { method: "PATCH", body: JSON.stringify({ cardId: card.id, position }) }); await load(); }
    catch (reorderError) { setError(reorderError instanceof Error ? reorderError.message : "Reorder failed"); await load(); }
  }
  function onDragEnd(event: DragEndEvent) {
    const id = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveId(null);
    if (!overId) return;
    const card = cardById.get(id);
    if (!card) return;
    const directStage = ACTIVE_STAGES.find((stage) => stage === overId);
    const overCard = cardById.get(overId);
    const destination = directStage || overCard?.stage;
    if (destination === card.stage && overCard) void reorderCard(card, overCard);
    else if (destination) void moveCard(card, destination);
  }

  async function archiveCard(card: TrelloWorkCard) {
    if (!confirm(`Archive “${card.name}”? You can restore it in Trello.`)) return;
    setPayload((current) => current ? { ...current, cards: current.cards.filter((item) => item.id !== card.id) } : current);
    try { await api(`/api/trello?cardId=${encodeURIComponent(card.id)}`, { method: "DELETE" }); }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "Archive failed"); await load(); }
  }

  if (loading) return <div className="board-status">Loading Trello…</div>;
  return (
    <>
      <div className="command-toolbar">
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Filter by project"><option value="all">All projects</option>{(payload?.boards || []).map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}</select>
        <select value={labelId} onChange={(event) => setLabelId(event.target.value)} aria-label="Filter by label"><option value="all">All labels</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name || label.color || "Unnamed"}</option>)}</select>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards…" aria-label="Search cards" />
        <button className="btn" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button>
        <button className={`btn ${showCompleted ? "btn-primary" : ""}`} onClick={() => { setShowCompleted((value) => !value); setMobileStage(showCompleted ? "next" : "done"); }}>{showCompleted ? "Active work" : "Completed"}</button>
        <span className="sync-time">{payload ? `Updated ${new Date(payload.syncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>
      </div>

      <div className="mobile-stage-tabs" role="tablist" aria-label="Workflow stage">{stages.map((stage) => <button key={stage} className={mobileStage === stage ? "active" : ""} onClick={() => setMobileStage(stage)}>{WORKFLOW_LABELS[stage]} <span>{cards[stage].length}</span></button>)}</div>
      {error ? <div className="banner banner-error" onClick={() => setError(null)}>{error} · tap to dismiss</div> : null}
      {(payload?.missingWorkflow.length || 0) > 0 ? <details className="workflow-warning"><summary>{payload?.missingWorkflow.length} project board(s) need standard workflow lists</summary>{payload?.missingWorkflow.map((item) => <div key={item.boardId}>{item.boardName}: {item.missing.map((stage) => WORKFLOW_LABELS[stage]).join(", ")}</div>)}</details> : null}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className={`trello-board ${showCompleted ? "completed-board" : ""}`}>{stages.map((stage) => <WorkflowColumn key={stage} stage={stage} cards={cards[stage]} hiddenOnMobile={stage !== mobileStage} onAdd={() => setAddingStage(stage)} onEdit={setEditing} onComplete={(card) => void moveCard(card, card.stage === "done" ? "next" : "done")} onArchive={(card) => void archiveCard(card)} />)}</div>
        <DragOverlay>{activeId && cardById.get(activeId) ? <WorkCard card={cardById.get(activeId)!} dragging /> : null}</DragOverlay>
      </DndContext>

      {addingStage ? <CardDialog title={`Add to ${WORKFLOW_LABELS[addingStage]}`} boards={(payload?.boards || []).filter((board) => !!board.lists[addingStage])} stage={addingStage} onClose={() => setAddingStage(null)} onSaved={async () => { setAddingStage(null); await load(); }} /> : null}
      {editing ? <CardDialog title="Edit card" boards={payload?.boards || []} stage={editing.stage} card={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} /> : null}
    </>
  );
}

function WorkflowColumn({ stage, cards, hiddenOnMobile, onAdd, onEdit, onComplete, onArchive }: { stage: WorkflowStage; cards: TrelloWorkCard[]; hiddenOnMobile: boolean; onAdd: () => void; onEdit: (card: TrelloWorkCard) => void; onComplete: (card: TrelloWorkCard) => void; onArchive: (card: TrelloWorkCard) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return <section className={`workflow-column stage-${stage} ${isOver ? "column-over" : ""} ${hiddenOnMobile ? "mobile-hidden" : ""}`}><header><h2>{WORKFLOW_LABELS[stage]}</h2><div><span>{cards.length}</span>{stage !== "done" ? <button onClick={onAdd} aria-label={`Add to ${WORKFLOW_LABELS[stage]}`}>+</button> : null}</div></header><div ref={setNodeRef} className="workflow-cards"><SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>{cards.map((card) => <SortableWorkCard key={card.id} card={card} onEdit={onEdit} onComplete={onComplete} onArchive={onArchive} />)}</SortableContext>{cards.length === 0 ? <div className="column-empty">{stage === "done" ? "Nothing completed" : "Drop here"}</div> : null}</div></section>;
}

function SortableWorkCard({ card, onEdit, onComplete, onArchive }: { card: TrelloWorkCard; onEdit: (card: TrelloWorkCard) => void; onComplete: (card: TrelloWorkCard) => void; onArchive: (card: TrelloWorkCard) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }} {...attributes} {...listeners}><WorkCard card={card} onEdit={onEdit} onComplete={onComplete} onArchive={onArchive} /></div>;
}

function WorkCard({ card, onEdit, onComplete, onArchive, dragging }: { card: TrelloWorkCard; onEdit?: (card: TrelloWorkCard) => void; onComplete?: (card: TrelloWorkCard) => void; onArchive?: (card: TrelloWorkCard) => void; dragging?: boolean }) {
  const days = ageInDays(card.lastActivityAt);
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  return <article className={`work-card ${dragging ? "dragging" : ""}`} onClick={() => onEdit?.(card)}><div className="work-card-top"><label className="complete-control" onPointerDown={stop} onClick={stop} title={card.stage === "done" ? "Return to Next Up" : "Complete"}><input type="checkbox" checked={card.stage === "done"} onChange={() => onComplete?.(card)} /><span className="sr-only">{card.stage === "done" ? "Return to Next Up" : "Complete"}</span></label><span className="project-pill" title={card.boardName}>{card.boardName}</span><button className="archive-button" onPointerDown={stop} onClick={(event) => { stop(event); onArchive?.(card); }} aria-label={`Archive ${card.name}`} title="Archive">⌫</button></div><h3>{card.name}</h3>{card.description ? <p>{card.description}</p> : null}{card.labels.length ? <div className="card-labels">{card.labels.map((label) => <span key={label.id} style={{ borderColor: labelColor(label.color) }}>{label.name || label.color}</span>)}</div> : null}<div className="work-card-meta">{card.checklistTotal ? <span>☑ {card.checklistComplete}/{card.checklistTotal}</span> : null}{card.due ? <span className={new Date(card.due) < new Date() ? "overdue" : ""}>Due {new Date(card.due).toLocaleDateString()}</span> : null}<span className={days >= 7 ? "stale" : days >= 3 ? "warm" : ""}>{days === 0 ? "today" : `${days}d untouched`}</span></div></article>;
}

function CardDialog({ title, boards, stage, card, onClose, onSaved }: { title: string; boards: TrelloBoard[]; stage: WorkflowStage; card?: TrelloWorkCard; onClose: () => void; onSaved: () => Promise<void> }) {
  const [boardId, setBoardId] = useState(card?.boardId || boards[0]?.id || "");
  const [name, setName] = useState(card?.name || "");
  const [description, setDescription] = useState(card?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { setError("A card title is required."); return; }
    const listId = boards.find((item) => item.id === boardId)?.lists[stage];
    if (!card && !listId) { setError(`That project has no ${WORKFLOW_LABELS[stage]} list.`); return; }
    setSaving(true);
    try { await api("/api/trello", { method: card ? "PATCH" : "POST", body: JSON.stringify(card ? { cardId: card.id, name: trimmed, description } : { listId, name: trimmed, description }) }); await onSaved(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Save failed"); setSaving(false); }
  }
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="card-dialog" role="dialog" aria-modal="true" aria-labelledby="card-dialog-title"><header><h2 id="card-dialog-title">{title}</h2><button onClick={onClose} aria-label="Close">×</button></header>{!card ? <label>Project<select value={boardId} onChange={(event) => setBoardId(event.target.value)}>{boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}</select></label> : <span className="project-pill dialog-project">{card.boardName}</span>}<label>Title<input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label>Notes<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={10} placeholder="Trello card description…" /></label>{card ? <a className="trello-link" href={card.url} target="_blank" rel="noreferrer">Open in Trello ↗</a> : null}{error ? <p className="error">{error}</p> : null}<footer><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</button></footer></section></div>;
}
