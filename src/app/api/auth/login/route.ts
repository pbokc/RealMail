import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getDb } from "@/lib/db";
import { getRpConfig } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.json();
  const address = body.address?.trim();

  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }

  const db = getDb();
  const { rpID } = getRpConfig();

  const user = db
    .prepare("SELECT id FROM users WHERE address = ?")
    .get(address) as { id: string } | undefined;

  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const userPasskeys = db
    .prepare("SELECT credential_id, transports FROM passkeys WHERE user_id = ?")
    .all(user.id) as { credential_id: string; transports: string }[];

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: userPasskeys.map((pk) => ({
      id: pk.credential_id,
      transports: JSON.parse(pk.transports || "[]"),
    })),
  });

  const challengeId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO challenges (id, user_id, challenge, type) VALUES (?, ?, ?, ?)"
  ).run(challengeId, null, options.challenge, "login");

  return NextResponse.json({ options, challengeId });
}
