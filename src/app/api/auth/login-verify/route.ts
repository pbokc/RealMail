import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getDb } from "@/lib/db";
import { getRpConfig, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { challengeId, credential } = await req.json();

  const db = getDb();
  const { rpID, origin } = getRpConfig();

  const challengeRow = db
    .prepare("SELECT challenge FROM challenges WHERE id = ? AND type = 'login'")
    .get(challengeId) as { challenge: string } | undefined;

  if (!challengeRow) {
    return NextResponse.json({ error: "No challenge found" }, { status: 400 });
  }

  const credentialId = credential.id;
  const passkey = db
    .prepare("SELECT * FROM passkeys WHERE credential_id = ?")
    .get(credentialId) as {
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
      expectedChallenge: challengeRow.challenge,
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

    // Clean up challenge
    db.prepare("DELETE FROM challenges WHERE id = ?").run(challengeId);

    const user = db
      .prepare("SELECT id, address FROM users WHERE id = ?")
      .get(passkey.user_id) as { id: string; address: string };

    await createSession(user.id, user.address);

    return NextResponse.json({ verified: true, address: user.address });
  } catch (err) {
    console.error("Login verify error:", err);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 400 }
    );
  }
}
