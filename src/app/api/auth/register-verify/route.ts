import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getDb } from "@/lib/db";
import { getRpConfig, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { userId, credential } = await req.json();

  const db = getDb();
  const { rpID, origin } = getRpConfig();

  const challengeRow = db
    .prepare(
      "SELECT challenge FROM challenges WHERE user_id = ? AND type = 'registration' ORDER BY created_at DESC LIMIT 1"
    )
    .get(userId) as { challenge: string } | undefined;

  if (!challengeRow) {
    return NextResponse.json({ error: "No challenge found" }, { status: 400 });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    const { credential: cred } = verification.registrationInfo;

    db.prepare(
      "INSERT INTO passkeys (credential_id, user_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)"
    ).run(
      Buffer.from(cred.id).toString("base64url"),
      userId,
      Buffer.from(cred.publicKey),
      cred.counter,
      JSON.stringify(credential.response?.transports || [])
    );

    // Clean up challenge
    db.prepare("DELETE FROM challenges WHERE user_id = ? AND type = 'registration'").run(
      userId
    );

    const user = db.prepare("SELECT address FROM users WHERE id = ?").get(userId) as {
      address: string;
    };
    await createSession(userId, user.address);

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("Registration verify error:", err);
    // Clean up user if verification fails
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 400 }
    );
  }
}
