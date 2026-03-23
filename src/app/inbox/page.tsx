"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Thread {
  thread_id: string;
  subject: string;
  from_address: string;
  to_address: string;
  body: string;
  sent_at: string;
  message_count: number;
  unread_count: number;
}

export default function InboxPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          router.replace("/login");
          return;
        }
        setAddress(data.address);
      });

    fetch("/api/messages/inbox")
      .then((r) => r.json())
      .then((data) => {
        setThreads(data.threads || []);
        setLoading(false);
      });
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }

  function otherParty(thread: Thread) {
    return thread.from_address === address
      ? thread.to_address
      : thread.from_address;
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Inbox</h1>
          <p className="text-xs text-gray-500">{address}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/compose")}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
          >
            Compose
          </button>
          <button
            onClick={handleLogout}
            className="text-gray-500 px-3 py-2 rounded-md hover:bg-gray-100 text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : threads.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No messages</p>
          <p className="text-sm mt-1">Compose a message to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          {threads.map((thread, i) => {
            const unread = thread.unread_count > 0;
            return (
              <button
                key={thread.thread_id}
                onClick={() => router.push(`/thread?id=${thread.thread_id}`)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 ${
                  i < threads.length - 1 ? "border-b border-gray-100" : ""
                } ${unread ? "bg-blue-50/50" : ""}`}
              >
                <div className="w-44 shrink-0 flex items-center gap-2">
                  <span className={`text-sm truncate ${unread ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                    {otherParty(thread)}
                  </span>
                  {unread && (
                    <span className="bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                      {thread.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex items-baseline gap-2">
                  <span className={`text-sm truncate ${unread ? "font-semibold text-gray-900" : "text-gray-800"}`}>
                    {thread.subject}
                  </span>
                  <span className="text-sm text-gray-400 truncate hidden sm:inline">
                    — {thread.body.substring(0, 80)}
                  </span>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 ml-2">
                  {formatDate(thread.sent_at)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
