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
    // Check session
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          router.replace("/login");
          return;
        }
        setAddress(data.address);
      });

    // Fetch inbox
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
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString();
  }

  function otherParty(thread: Thread) {
    return thread.from_address === address
      ? thread.to_address
      : thread.from_address;
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-gray-500">{address}</p>
        </div>
        <div className="space-x-2">
          <button
            onClick={() => router.push("/compose")}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Compose
          </button>
          <button
            onClick={handleLogout}
            className="text-gray-600 px-4 py-2 rounded-md hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : threads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No messages yet</p>
          <p className="text-sm mt-1">Send one to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y">
          {threads.map((thread) => (
            <button
              key={thread.thread_id}
              onClick={() =>
                router.push(`/thread?id=${thread.thread_id}`)
              }
              className={`w-full text-left p-4 hover:bg-gray-50 ${
                thread.unread_count > 0 ? "bg-blue-50" : ""
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm ${
                        thread.unread_count > 0
                          ? "font-bold"
                          : "text-gray-600"
                      }`}
                    >
                      {otherParty(thread)}
                    </span>
                    {thread.unread_count > 0 && (
                      <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {thread.unread_count}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm truncate ${
                      thread.unread_count > 0 ? "font-semibold" : ""
                    }`}
                  >
                    {thread.subject}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {thread.body.substring(0, 100)}
                  </p>
                </div>
                <div className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                  <div>{formatDate(thread.sent_at)}</div>
                  <div className="text-right">{thread.message_count} msg</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
