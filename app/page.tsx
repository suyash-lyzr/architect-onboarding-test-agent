"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

type TranscriptItem = {
  streamKey: string;
  speaker: "agent" | "you" | "system";
  text: string;
  partial?: boolean;
};

type StartSessionResponse = {
  roomName?: string;
  url?: string;
  serverUrl?: string;
  wsUrl?: string;
  livekitUrl?: string;
  token?: string;
  userToken?: string;
  room?: { name?: string };
};

async function clearClientStoresForFreshSession() {
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }

  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof document !== "undefined" && document.cookie) {
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0]?.trim();
        if (!name) return;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
    }
  } catch {
    /* ignore */
  }
}

function removeSandboxAudioElements() {
  document
    .querySelectorAll("audio[data-voice-sandbox-audio]")
    .forEach((el) => el.remove());
}

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const roomRef = useRef<Room | null>(null);
  const roomNameRef = useRef<string | null>(null);
  const transcriptBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!transcriptBoxRef.current) return;
    transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
  }, [transcripts]);

  const disconnectRoomAndEndSession = useCallback(async () => {
    const room = roomRef.current;

    if (room) {
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch {
        /* ignore */
      }
      await room.disconnect();
      roomRef.current = null;
    }

    removeSandboxAudioElements();

    if (roomNameRef.current) {
      try {
        await fetch("/api/session/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: roomNameRef.current }),
        });
      } catch {
        // Ignore end errors during cleanup.
      }
      roomNameRef.current = null;
    }

    setIsConnected(false);
  }, []);

  /** User clicked Stop: tear down room and clear client state so the next session is fresh. */
  const stopConversation = useCallback(async () => {
    await disconnectRoomAndEndSession();
    await clearClientStoresForFreshSession();
    setTranscripts([]);
  }, [disconnectRoomAndEndSession]);

  useEffect(() => {
    return () => {
      void disconnectRoomAndEndSession();
    };
  }, [disconnectRoomAndEndSession]);

  async function startConversation() {
    setError(null);
    setIsConnecting(true);

    try {
      const startRes = await fetch("/api/session/start", { method: "POST" });
      const startBody = (await startRes.json()) as StartSessionResponse & {
        error?: string;
      };

      if (!startRes.ok) {
        throw new Error(startBody.error || "Failed to start voice session.");
      }

      const serverUrl =
        startBody.url ||
        startBody.serverUrl ||
        startBody.wsUrl ||
        startBody.livekitUrl ||
        "";
      const token = startBody.userToken || startBody.token || "";
      const roomName = startBody.roomName || startBody.room?.name || null;

      if (!serverUrl || !token) {
        throw new Error(
          "Session start response missing url/token. Check your Lyzr agent session response."
        );
      }

      roomNameRef.current = roomName;
      const room = new Room();

      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const localIdentity = room.localParticipant.identity;
        const speaker: "agent" | "you" =
          participant && participant.identity === localIdentity ? "you" : "agent";

        setTranscripts((prev) => {
          const next = [...prev];
          for (const segment of segments) {
            const raw = segment.text ?? "";
            const streamKey = `${speaker}:${segment.id}`;
            const idx = next.findIndex((t) => t.streamKey === streamKey);
            const text = raw.trim();
            const isFinal = segment.final === true;

            if (!text && idx < 0 && !isFinal) {
              continue;
            }

            const prevText = idx >= 0 ? next[idx].text : "";
            const nextText = text || prevText;
            if (!nextText) continue;

            const item: TranscriptItem = {
              streamKey,
              speaker,
              text: nextText,
              partial: !isFinal,
            };

            if (idx >= 0) {
              next[idx] = item;
            } else {
              next.push(item);
            }
          }
          return next;
        });
      });

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const mediaElement = track.attach();
        if (mediaElement instanceof HTMLAudioElement) {
          mediaElement.autoplay = true;
          mediaElement.style.display = "none";
          mediaElement.dataset.voiceSandboxAudio = "1";
          document.body.appendChild(mediaElement);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        removeSandboxAudioElements();
      });

      await room.connect(serverUrl, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      roomRef.current = room;
      setIsConnected(true);
      setTranscripts((prev) => [
        ...prev,
        {
          streamKey: `system:connected-${Date.now()}`,
          speaker: "system",
          text: "Voice session connected. You can start speaking.",
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error.");
      await stopConversation();
    } finally {
      setIsConnecting(false);
    }
  }

  async function toggleConversation() {
    if (isConnecting) return;
    if (isConnected) {
      await stopConversation();
      return;
    }
    await startConversation();
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Lyzr Voice Agent Test</h1>
          <p className="text-sm text-neutral-400">
            Click the mic, speak, and verify agent replies + transcripts.
          </p>
        </div>

        <div className="flex justify-center">
          <button
            onClick={toggleConversation}
            disabled={isConnecting}
            className={[
              "w-32 h-32 rounded-full font-semibold text-sm transition-all",
              "flex items-center justify-center border",
              isConnected
                ? "bg-red-500/90 border-red-400 text-white shadow-[0_0_40px_rgba(239,68,68,0.35)]"
                : "bg-emerald-500/90 border-emerald-300 text-white shadow-[0_0_40px_rgba(16,185,129,0.35)]",
              isConnecting ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.02]",
            ].join(" ")}
          >
            {isConnecting ? "Connecting..." : isConnected ? "Stop" : "Start Mic"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div
          ref={transcriptBoxRef}
          className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3 h-80 overflow-y-auto flex flex-col gap-2"
        >
          {transcripts.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Transcripts will appear here...
            </p>
          ) : (
            transcripts.map((item) => (
              <div
                key={item.streamKey}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              >
                <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">
                  {item.speaker === "system" ? "session" : item.speaker}
                  {item.partial ? (
                    <span className="ml-2 normal-case text-neutral-500 font-normal">
                      (live)
                    </span>
                  ) : null}
                </p>
                <p
                  className={
                    item.partial
                      ? "text-sm text-neutral-300 italic"
                      : "text-sm text-neutral-100"
                  }
                >
                  {item.text}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
