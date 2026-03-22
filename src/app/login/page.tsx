"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);

    try {
      // Step 1: Get authentication options
      const res = await fetch("/api/auth/login", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start login");

      const { options, challengeId } = await res.json();

      // Step 2: Authenticate via passkey (FaceID/TouchID)
      const credential = await startAuthentication({ optionsJSON: options });

      // Step 3: Verify
      const verifyRes = await fetch("/api/auth/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, credential }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || "Login failed");
      }

      router.push("/inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">RealMail</h1>
        <p className="text-gray-600 mb-6">Passkey-secured messaging</p>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 text-lg"
        >
          {loading ? "Authenticating..." : "Sign in with Passkey"}
        </button>
        <p className="mt-4 text-sm text-gray-600">
          New here?{" "}
          <a href="/register" className="text-blue-600 hover:underline">
            Create account
          </a>
        </p>
      </div>
    </div>
  );
}
