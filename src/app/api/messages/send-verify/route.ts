import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getDb } from "@/lib/db";
import { getSession, getRpConfig } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { challengeId, credential } = await req.json();

  const db = getDb();
  const { rpID, origin } = getRpConfig();

  const challengeRow = db
    .prepare(
      "SELECT challenge FROM challenges WHERE id = ? AND user_id = ? AND type = 'send'"
    )
    .get(challengeId, session.userId) as { challenge: string } | undefined;

  if (!challengeRow) {
    return NextResponse.json({ error: "No challenge found" }, { status: 400 });
  }

  const challengeData = JSON.parse(challengeRow.challenge);

  // Find the user's passkey
  const credentialId = credential.id;
  const passkey = db
    .prepare(
      "SELECT * FROM passkeys WHERE credential_id = ? AND user_id = ?"
    )
    .get(credentialId, session.userId) as {
    credential_id: string;
    user_id: string;
    public_key: Buffer;
    counter: number;
    transports: string;
  } | undefined;

  if (!passkey) {
    return NextResponse.json(
      { error: "Unknown credential" },
      { status: 400 }
    );
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(passkey.public_key),
        counter: passkey.counter,
        transports: JSON.parse(passkey.transports || "[]"),
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    // Update counter
    db.prepare("UPDATE passkeys SET counter = ? WHERE credential_id = ?").run(
      verification.authenticationInfo.newCounter,
      credentialId
    );

    // Re-check rate limit right before insert (double-check)
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const count = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM rate_limits WHERE user_id = ? AND sent_at > ?"
      )
      .get(session.userId, oneMinuteAgo) as { cnt: number };

    if (count.cnt >= 20) {
      db.prepare("DELETE FROM challenges WHERE id = ?").run(challengeId);
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    // Insert message — immutable, no undo
    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      "INSERT INTO messages (id, thread_id, from_address, to_address, subject, body, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      messageId,
      challengeData.threadId,
      session.address,
      challengeData.to,
      challengeData.subject,
      challengeData.body,
      now
    );

    // Record for rate limiting
    db.prepare("INSERT INTO rate_limits (user_id, sent_at) VALUES (?, ?)").run(
      session.userId,
      now
    );

    // Clean up challenge
    db.prepare("DELETE FROM challenges WHERE id = ?").run(challengeId);

    return NextResponse.json({ sent: true, messageId });
  } catch (err) {
    console.error("Send verify error:", err);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 400 }
    );
  }
}
