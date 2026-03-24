"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

type TranscriptItem = {
  id: string;
  speaker: "agent" | "you";
  text: string;
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

  const stopConversation = useCallback(async () => {
    const room = roomRef.current;

    if (room) {
      await room.localParticipant.setMicrophoneEnabled(false);
      room.disconnect();
      roomRef.current = null;
    }

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

  useEffect(() => {
    return () => {
      void stopConversation();
    };
  }, [stopConversation]);

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
        const speaker: "agent" | "you" =
          participant?.identity?.toLowerCase().includes("agent") ? "agent" : "you";

        const lines = segments
          .filter((segment) => segment.final && segment.text.trim().length > 0)
          .map((segment) => ({
            id: `${segment.id}-${Date.now()}`,
            speaker,
            text: segment.text.trim(),
          }));

        if (lines.length > 0) {
          setTranscripts((prev) => [...prev, ...lines]);
        }
      });

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const mediaElement = track.attach();
        if (mediaElement instanceof HTMLAudioElement) {
          mediaElement.autoplay = true;
          mediaElement.style.display = "none";
          document.body.appendChild(mediaElement);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
      });

      await room.connect(serverUrl, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      roomRef.current = room;
      setIsConnected(true);
      setTranscripts((prev) => [
        ...prev,
        {
          id: `status-${Date.now()}`,
          speaker: "agent",
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
                key={item.id}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              >
                <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">
                  {item.speaker}
                </p>
                <p className="text-sm text-neutral-100">{item.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
