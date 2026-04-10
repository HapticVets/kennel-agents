"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErrorMessage(data.error || "Unable to sign in.");
        return;
      }

      router.push("/admin/operator");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <section className="card" style={{ maxWidth: 460, margin: "80px auto 0" }}>
        <p className="eyebrow">Admin Access</p>
        <h1>Sign in</h1>
        <p className="muted">
          The deployed puppy listing dashboard is protected behind a simple admin login.
        </p>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        <form className="intake-form" onSubmit={handleSubmit}>
          <label className="approval-filter">
            Email or local username
            <input
              className="text-input"
              onChange={(event) => setUsername(event.target.value)}
              required
              type="text"
              value={username}
            />
          </label>
          <label className="approval-filter">
            Password
            <input
              className="text-input"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
