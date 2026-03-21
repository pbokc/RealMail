import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getDb } from "@/lib/db";
import { getSession, getRpConfig } from "@/lib/auth";
import crypto from "crypto";

// Step 1: User wants to send a message. Generate a passkey challenge.
// The actual message content is stored temporarily until passkey verification.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { to, subject, body, threadId } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify recipient exists
  const db = getDb();
  const recipient = db
    .prepare("SELECT id FROM users WHERE address = ?")
    .get(to);
  if (!recipient) {
    return NextResponse.json(
      { error: "Recipient not found" },
      { status: 404 }
    );
  }

  // Check rate limit: 20 messages per minute
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const count = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM rate_limits WHERE user_id = ? AND sent_at > ?"
    )
    .get(session.userId, oneMinuteAgo) as { cnt: number };

  if (count.cnt >= 20) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 20 messages per minute." },
      { status: 429 }
    );
  }

  const { rpID } = getRpConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });

  // Store challenge with message data
  const challengeId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO challenges (id, user_id, challenge, type) VALUES (?, ?, ?, ?)"
  ).run(
    challengeId,
    session.userId,
    JSON.stringify({
      challenge: options.challenge,
      to,
      subject,
      body,
      threadId: threadId || crypto.randomUUID(),
    }),
    "send"
  );

  return NextResponse.json({ options, challengeId });
}
