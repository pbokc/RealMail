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
      const credential = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/messages/send-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, credential }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || "Send failed");
      }

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

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (!threadId) return <p>No thread selected</p>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <button
        onClick={() => router.push("/inbox")}
        className="text-blue-600 hover:underline mb-4 inline-block text-sm"
      >
        &larr; Back to Inbox
      </button>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <h1 className="text-xl font-bold mb-6">
            {messages[0]?.subject || "Thread"}
          </h1>

          <div className="space-y-0 border border-gray-200 rounded-lg bg-white">
            {messages.map((msg, i) => (
              <div
                key={msg.id}
                className={i < messages.length - 1 ? "border-b border-gray-200" : ""}
              >
                <div className="px-6 py-4">
                  <div className="flex justify-between items-baseline mb-3">
                    <div>
                      <span className="font-medium text-sm text-gray-900">
                        {msg.from_address === address ? "You" : msg.from_address}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        to {msg.to_address === address ? "You" : msg.to_address}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                      {formatDate(msg.sent_at)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {msg.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border border-gray-200 rounded-lg bg-white p-6">
            <form onSubmit={handleReply}>
              <div className="text-sm text-gray-500 mb-3">
                Reply to{" "}
                {messages[messages.length - 1]?.from_address === address
                  ? messages[messages.length - 1]?.to_address
                  : messages[messages.length - 1]?.from_address}
              </div>
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={6}
                placeholder="Write your reply..."
                required
              />
              {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={sending}
                  className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {sending ? "Sending..." : "Send Reply"}
                </button>
                <span className="text-xs text-gray-400">
                  Requires passkey verification
                </span>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default function ThreadPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto p-4">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <ThreadContent />
    </Suspense>
  );
}
