import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getDb } from "@/lib/db";
import { getRpConfig } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.json();
  const address = body.address?.trim();
  const displayName = body.displayName?.trim();

  if (!address || !displayName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const emailRegex = /^[a-zA-Z0-9._-]+@realmail\.app$/;
  if (!emailRegex.test(address)) {
    return NextResponse.json(
      { error: "Address must be like user@realmail.app" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM users WHERE address = ?")
    .get(address);
  if (existing) {
    return NextResponse.json(
      { error: "Address already taken" },
      { status: 409 }
    );
  }

  const userId = crypto.randomUUID();
  const { rpName, rpID } = getRpConfig();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: address,
    userDisplayName: displayName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });

  // Store challenge temporarily
  db.prepare(
    "INSERT INTO challenges (id, user_id, challenge, type) VALUES (?, ?, ?, ?)"
  ).run(crypto.randomUUID(), userId, options.challenge, "registration");

  // Store pending user info in challenge metadata
  db.prepare("INSERT INTO users (id, address, display_name) VALUES (?, ?, ?)").run(
    userId,
    address,
    displayName
  );

  return NextResponse.json({ options, userId });
}
