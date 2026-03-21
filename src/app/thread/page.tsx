"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

interface Message {
  id: string;
  thread_id: string;
  from_address: string;
  to_address: string;
  subject: string;
  body: string;
  sent_at: string;
  read: number;
}

function ThreadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadId = searchParams.get("id");

  const [messages, setMessages] = useState<Message[]>([]);
  const [address, setAddress] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!threadId) return;

    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          router.replace("/login");
          return;
        }
        setAddress(data.address);
      });

    fetch(`/api/messages/thread?id=${threadId}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages || []);
        setLoading(false);
      });
  }, [threadId, router]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setError("");
    setSending(true);

    try {
      const lastMsg = messages[messages.length - 1];
      const to =
        lastMsg.from_address === address
          ? lastMsg.to_address
          : lastMsg.from_address;

      // Step 1: Request send challenge
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject: lastMsg.subject.startsWith("Re: ")
            ? lastMsg.subject
            : `Re: ${lastMsg.subject}`,
          body: replyBody,
          threadId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to prepare send");
      }

      const { options, challengeId } = await res.json();

      // Step 2: Passkey authentication (FaceID/TouchID)
      const credential = await startAuthentication({ optionsJSON: options });

      // Step 3: Verify and send
      const verifyRes = await fetch("/api/messages/send-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, credential }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || "Send failed");
      }

      // Refresh messages
      setReplyBody("");
      const threadRes = await fetch(`/api/messages/thread?id=${threadId}`);
      const threadData = await threadRes.json();
      setMessages(threadData.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  if (!threadId) return <p>No thread selected</p>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <button
        onClick={() => router.push("/inbox")}
        className="text-blue-600 hover:underline mb-4 inline-block"
      >
        &larr; Back to Inbox
      </button>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <h1 className="text-xl font-bold mb-4">
            {messages[0]?.subject || "Thread"}
          </h1>

          <div className="space-y-4 mb-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.from_address === address
                    ? "bg-blue-50 ml-8"
                    : "bg-white shadow mr-8"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium">
                    {msg.from_address === address ? "You" : msg.from_address}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.sent_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleReply} className="space-y-3">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
              placeholder="Write a reply..."
              required
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? "Authenticating & Sending..." : "Reply (requires Passkey)"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ThreadPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto p-4">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <ThreadContent />
    </Suspense>
  );
}
