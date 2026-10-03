"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startScribe, type ScribeHandle } from "@/lib/scribe";

/**
 * Mic → live text. `text` is everything heard so far (committed + partial);
 * `level` drives the waveform. Call stop() to finish.
 */
export function useDictation() {
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [committed, setCommitted] = useState("");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const handle = useRef<ScribeHandle | null>(null);

  const start = useCallback(async () => {
    if (handle.current) return;
    setError(null);
    setCommitted("");
    setPartial("");
    setStarting(true);
    try {
      handle.current = await startScribe({
        onLevel: setLevel,
        onPartial: setPartial,
        onCommitted: (t) => {
          setCommitted((c) => `${c} ${t}`.trim());
          setPartial("");
        },
        onError: (m) => setError(m),
        onClose: () => {
          handle.current = null;
          setListening(false);
        },
      });
      setListening(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }, []);

  const stop = useCallback(() => {
    handle.current?.stop();
  }, []);

  useEffect(() => () => handle.current?.stop(), []);

  return {
    start,
    stop,
    listening,
    starting,
    error,
    level,
    text: `${committed} ${partial}`.trim(),
    finalText: committed,
  };
}
