"use client";

import { Camera, ImageIcon, Plus, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DictateButton } from "@/components/dictate-button";
import { MealCard } from "@/components/log/meal-card";
import { inputClass, primaryButton } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { Thinking } from "@/components/ui/thinking";
import { VoiceRecorder } from "@/components/voice-recorder";
import { postJson } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { useStore } from "@/lib/store";
import type { MealDraft, MealItem, MealLog, MealSource } from "@/lib/types";
import { useDictation } from "@/lib/use-dictation";

/**
 * Camera / voice / chat → AI estimate → confirmation card → log (SPEC §7.6).
 * Also opens the card for suggestions, search answers and editing a meal.
 */

interface Estimate {
  title: string;
  items: Required<MealItem>[];
  assumptions: string;
  confidence: "low" | "medium" | "high";
  question: string | null;
}

interface AiInput {
  images: string[];
  text: string;
}

type Sheet =
  | null
  | { kind: "camera" }
  | { kind: "voice" }
  | { kind: "chat"; message?: string }
  | { kind: "card"; draft: MealDraft; mode: "new" | "edit"; mealId?: string; ai?: AiInput };

interface LogFlow {
  pickPhotos: () => void;
  openVoice: () => void;
  openChat: (message?: string) => void;
  openDraft: (draft: MealDraft) => void;
  editMeal: (meal: MealLog) => void;
}

const LogFlowContext = createContext<LogFlow | null>(null);

export function useLogFlow(): LogFlow {
  const flow = useContext(LogFlowContext);
  if (!flow) throw new Error("useLogFlow must be used inside <LogFlowProvider>");
  return flow;
}

function toDraft(e: Estimate, source: MealSource): MealDraft {
  return { title: e.title, items: e.items, source, assumptions: e.assumptions, question: e.question };
}

function toEstimate(d: MealDraft): Estimate {
  return {
    title: d.title,
    items: d.items.map((i) => ({ carbs: 0, fat: 0, fibre: 0, ...i })),
    assumptions: d.assumptions ?? "",
    confidence: "medium",
    question: null,
  };
}

export function LogFlowProvider({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [chatText, setChatText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const dictation = useDictation();

  const close = useCallback(() => {
    if (dictation.listening) dictation.stop();
    setSheet(null);
    setBusy(false);
    setError(null);
  }, [dictation]);

  const estimate = useCallback(async (input: AiInput, source: MealSource) => {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<Estimate>("/api/ai/estimate", input);
      setSheet({ kind: "card", draft: toDraft(result, source), mode: "new", ai: input });
      setPhotos([]);
      setNote("");
      setChatText("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const flow = useMemo<LogFlow>(
    () => ({
      // iPhone shows its own menu: Take Photo / Photo Library / Choose File,
      // so screenshots and saved photos work too (must run inside the tap).
      pickPhotos: () => libraryInput.current?.click(),
      openVoice: () => {
        setError(null);
        setSheet({ kind: "voice" });
        void dictation.start();
      },
      openChat: (message) => {
        setError(null);
        setSheet({ kind: "chat", message });
      },
      openDraft: (draft) => setSheet({ kind: "card", draft, mode: "new" }),
      editMeal: (meal) =>
        setSheet({
          kind: "card",
          mode: "edit",
          mealId: meal.id,
          draft: { title: meal.title, items: meal.items, source: meal.source },
        }),
    }),
    [dictation],
  );

  // Voice: when it fails (e.g. the free minutes are used up), fall back to typing.
  const voiceFailed = sheet?.kind === "voice" && !!dictation.error && !dictation.text && !dictation.listening;

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setPhotos((p) => [...p, ...Array.from(files)].slice(0, 4));
    setError(null);
    setSheet({ kind: "camera" });
  };

  const thumbs = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  const card = sheet?.kind === "card" ? sheet : null;

  return (
    <LogFlowContext.Provider value={flow}>
      {children}

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <Sheet open={sheet?.kind === "camera"} onClose={close} title="Photo">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {thumbs.map((src, i) => (
              <div key={src} className="relative size-20 overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of an unsent photo */}
                <img src={src} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/70"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {photos.length < 4 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Take another photo"
                  onClick={() => cameraInput.current?.click()}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-xs text-text-2"
                >
                  <Camera className="size-4" /> <Plus className="size-3" />
                </button>
                <button
                  type="button"
                  aria-label="Choose from library"
                  onClick={() => libraryInput.current?.click()}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-xs text-text-2"
                >
                  <ImageIcon className="size-4" /> Library
                </button>
              </div>
            )}
          </div>
          <div className="flex items-start gap-2">
            <textarea
              rows={2}
              className={`${inputClass} h-auto flex-1 py-3`}
              placeholder="Optional note, e.g. milk has 1 scoop whey and a banana"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <DictateButton value={note} onChange={setNote} />
          </div>
          <p role="alert" className="min-h-5 text-sm text-text-2">
            {error}
          </p>
          <button
            type="button"
            className={primaryButton}
            disabled={busy || photos.length === 0}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const images = await Promise.all(photos.map(compressImage));
                await estimate({ images, text: note }, "photo");
              } catch {
                setError("Couldn't read that photo. Try another.");
                setBusy(false);
              }
            }}
          >
            {busy ? <Thinking className="text-bg [&_*]:text-bg" /> : "Estimate"}
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet?.kind === "voice" && !voiceFailed} onClose={close} title="Say what you ate">
        <VoiceRecorder
          listening={dictation.listening}
          starting={dictation.starting}
          level={dictation.level}
          text={dictation.text}
          error={dictation.error}
          onStart={dictation.start}
          onStop={dictation.stop}
        />
        <p role="alert" className="min-h-5 text-sm text-text-2">
          {error}
        </p>
        <button
          type="button"
          className={primaryButton}
          disabled={busy || dictation.listening || !dictation.text}
          onClick={() => estimate({ images: [], text: dictation.text }, "voice")}
        >
          {busy ? <Thinking className="text-bg [&_*]:text-bg" /> : "Estimate"}
        </button>
      </Sheet>

      <Sheet open={sheet?.kind === "chat" || voiceFailed} onClose={close} title="What did you eat?">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (chatText.trim()) void estimate({ images: [], text: chatText }, "text");
          }}
        >
          {(voiceFailed ? dictation.error : sheet?.kind === "chat" && sheet.message) && (
            <p className="text-sm text-text-2">{voiceFailed ? dictation.error : sheet?.kind === "chat" ? sheet.message : null}</p>
          )}
          <textarea
            rows={3}
            autoFocus
            className={`${inputClass} h-auto py-3`}
            placeholder="e.g. 2 rotis, 1 katori dal, salad"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
          />
          <p role="alert" className="min-h-5 text-sm text-text-2">
            {error}
          </p>
          <button type="submit" className={primaryButton} disabled={busy || !chatText.trim()}>
            {busy ? <Thinking className="text-bg [&_*]:text-bg" /> : "Send"}
          </button>
        </form>
      </Sheet>

      <Sheet open={!!card} onClose={close} title={card?.mode === "edit" ? "Edit meal" : "Check and log"}>
        {card && (
          <MealCard
            key={JSON.stringify(card.draft)}
            initial={card.draft}
            mode={card.mode}
            onCancel={close}
            onDelete={
              card.mealId
                ? () => {
                    store.softDeleteMeal(card.mealId!);
                    store.hardDeleteMeal(card.mealId!);
                    close();
                  }
                : undefined
            }
            onSave={(draft) => {
              if (card.mode === "edit" && card.mealId) store.updateMeal(card.mealId, draft);
              else store.addMeal(draft);
              close();
            }}
            onReEstimate={
              card.ai
                ? async (draft, correction) => {
                    const result = await postJson<Estimate>("/api/ai/estimate", {
                      ...card.ai,
                      previous: toEstimate(draft),
                      correction,
                    });
                    return toDraft(result, draft.source);
                  }
                : undefined
            }
          />
        )}
      </Sheet>
    </LogFlowContext.Provider>
  );
}
