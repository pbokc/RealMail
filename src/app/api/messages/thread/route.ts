import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const threadId = url.searchParams.get("id");

  if (!threadId) {
    return NextResponse.json(
      { error: "Missing thread id" },
      { status: 400 }
    );
  }

  const db = getDb();

  const messages = db
    .prepare(
      `
    SELECT id, thread_id, from_address, to_address, subject, body, sent_at, read
    FROM messages
    WHERE thread_id = ? AND (from_address = ? OR to_address = ?)
    ORDER BY sent_at ASC
  `
    )
    .all(threadId, session.address, session.address);

  if (messages.length === 0) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Mark messages as read
  db.prepare(
    "UPDATE messages SET read = 1 WHERE thread_id = ? AND to_address = ? AND read = 0"
  ).run(threadId, session.address);

  return NextResponse.json({ messages });
}
