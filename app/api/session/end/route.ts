import { NextResponse } from "next/server";

const END_URL = "https://voice-livekit.studio.lyzr.ai/v1/sessions/end";

export async function POST(req: Request) {
  const apiKey = process.env.LYZR_API_KEY;
  const payload = (await req.json()) as { roomName?: string };
  const roomName = payload?.roomName;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing LYZR_API_KEY environment variable." },
      { status: 500 }
    );
  }

  if (!roomName) {
    return NextResponse.json(
      { error: "roomName is required to end the session." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(END_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ roomName }),
      cache: "no-store",
    });

    const body = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: body?.message || "Failed to end Lyzr voice session.", body },
        { status: response.status }
      );
    }

    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { error: "Unable to reach Lyzr voice session API." },
      { status: 500 }
    );
  }
}
