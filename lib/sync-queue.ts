"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Offline-first write queue. Every change the user makes (water, creatine,
 * manual entries, meal edits) is applied to the screen immediately, stored
 * here, then sent to Supabase in order. If the phone is offline, the queue
 * waits in localStorage and retries when the connection comes back.
 */

export type QueueOp =
  | { kind: "insert"; table: string; row: Record<string, unknown> }
  | { kind: "update"; table: string; match: Record<string, unknown>; patch: Record<string, unknown> }
  | { kind: "upsert"; table: string; row: Record<string, unknown>; onConflict: string }
  | { kind: "delete"; table: string; match: Record<string, unknown> };

interface StoredOp {
  id: string;
  op: QueueOp;
}

const key = (userId: string) => `tare.queue.${userId}`;

function read(userId: string): StoredOp[] {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? "[]");
  } catch {
    return [];
  }
}

function write(userId: string, ops: StoredOp[]) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(ops));
  } catch {
    // Storage full or blocked: the in-memory flush below still runs.
  }
}

export function pendingOps(userId: string): QueueOp[] {
  return read(userId).map((s) => s.op);
}

export function enqueue(userId: string, op: QueueOp) {
  write(userId, [...read(userId), { id: crypto.randomUUID(), op }]);
  void flush(userId);
}

let flushing: Promise<void> | null = null;

/** Sends queued ops in order. Stops at the first network failure. */
export function flush(userId: string): Promise<void> {
  flushing ??= run(userId).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function run(userId: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const supabase = createClient();

  for (;;) {
    const [next] = read(userId);
    if (!next) return;
    const { op } = next;

    let error: { message: string; code?: string } | null = null;
    try {
      if (op.kind === "insert") {
        ({ error } = await supabase.from(op.table).insert(op.row));
      } else if (op.kind === "upsert") {
        ({ error } = await supabase.from(op.table).upsert(op.row, { onConflict: op.onConflict }));
      } else if (op.kind === "update") {
        ({ error } = await supabase.from(op.table).update(op.patch).match(op.match));
      } else {
        ({ error } = await supabase.from(op.table).delete().match(op.match));
      }
    } catch {
      return; // Network failure: keep the op and try again later.
    }

    if (error && isRetryable(error)) return;
    if (error && error.code !== "23505") {
      // A permanent error (bad data). Drop it so the queue doesn't jam.
      console.error("Dropping queued change:", op, error.message);
    }
    write(
      userId,
      read(userId).filter((s) => s.id !== next.id),
    );
  }
}

function isRetryable(error: { message: string; code?: string }) {
  // PostgREST/JWT problems and fetch failures are temporary; data errors are not.
  return (
    !error.code ||
    error.code === "PGRST301" ||
    /fetch|network|jwt|timeout/i.test(error.message)
  );
}
