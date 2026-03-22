import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getDb } from "@/lib/db";
import { getRpConfig } from "@/lib/auth";
import crypto from "crypto";

export async function POST() {
  const db = getDb();
  const { rpID } = getRpConfig();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });

  const challengeId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO challenges (id, user_id, challenge, type) VALUES (?, ?, ?, ?)"
  ).run(challengeId, null, options.challenge, "login");

  return NextResponse.json({ options, challengeId });
}
