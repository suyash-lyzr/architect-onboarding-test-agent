import { NextResponse } from "next/server";

const START_URL = "https://voice-livekit.studio.lyzr.ai/v1/sessions/start";

export async function POST() {
  const apiKey = process.env.LYZR_API_KEY;
  const agentId = process.env.LYZR_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      {
        error:
          "Missing LYZR_API_KEY or LYZR_AGENT_ID environment variable.",
      },
      { status: 500 }
    );
  }

  try {
    const userIdentity = `sandbox-${crypto.randomUUID()}`;
    const response = await fetch(START_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ agentId, userIdentity }),
      cache: "no-store",
    });

    const body = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: body?.message || "Failed to start Lyzr voice session.", body },
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
