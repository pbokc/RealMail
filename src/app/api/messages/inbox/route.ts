import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb();

  // Get threads where user is sender or recipient, grouped by thread_id
  // Show latest message per thread
  const threads = db
    .prepare(
      `
    SELECT
      m.thread_id,
      m.subject,
      m.from_address,
      m.to_address,
      m.body,
      m.sent_at,
      (SELECT COUNT(*) FROM messages m2 WHERE m2.thread_id = m.thread_id) as message_count,
      (SELECT COUNT(*) FROM messages m3 WHERE m3.thread_id = m.thread_id AND m3.to_address = ? AND m3.read = 0) as unread_count
    FROM messages m
    WHERE m.id = (
      SELECT id FROM messages m4
      WHERE m4.thread_id = m.thread_id
      ORDER BY m4.sent_at DESC
      LIMIT 1
    )
    AND (m.from_address = ? OR m.to_address = ?)
    ORDER BY m.sent_at DESC
  `
    )
    .all(session.address, session.address, session.address);

  return NextResponse.json({ threads });
}
