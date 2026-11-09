"use client";
import { useState, useEffect } from "react";
import {
  Sparkles,
  ShieldCheck,
  KeyRound,
  Loader2,
  CheckCircle2,
  Power,
} from "lucide-react";
import { Field, useToast } from "./ui";
export function ProviderSettings() {
  const [status, setStatus] = useState<{
      configured: boolean;
      canConfigure: boolean;
      source: string;
      model: string;
    } | null>(null),
    [key, setKey] = useState(""),
    [model, setModel] = useState("gemini-2.5-flash"),
    [busy, setBusy] = useState(false),
    [desktop, setDesktop] = useState(false),
    notify = useToast();
  useEffect(() => {
    void fetch("/api/config/provider")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        setModel(data.model);
        setDesktop(data.canConfigure);
      })
      .catch(() => {});
  }, []);
  async function save(test = false) {
    setBusy(true);
    try {
      const response = await fetch("/api/config/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(key ? { key } : {}), model, test }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setKey("");
      setStatus({
        ...status!,
        configured: data.configured,
        model,
        source: status?.source === "environment" ? "environment" : "desktop",
      });
      notify(
        test
          ? "Gemini connection verified."
          : "Gemini configuration saved privately on this computer.",
      );
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not save the AI configuration.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-card provider-card">
      <h2>
        <Sparkles size={20} />
        ACE intelligence
      </h2>
      <p className="setting-help">
        Gemini understands flexible wording, context and follow-up requests in
        English, Roman Urdu, Urdu and German. The local fallback is a limited
        rule parser and is labeled clearly.
      </p>
      <div
        className={`provider-status ${status?.configured ? "connected" : ""}`}
      >
        {status?.configured ? (
          <CheckCircle2 size={17} />
        ) : (
          <KeyRound size={17} />
        )}
        <span>
          {status?.configured
            ? "Gemini connected"
            : "Local interpretation · Gemini not connected"}
          <small>
            {status?.configured
              ? `Configured through ${status.source === "desktop" ? "private desktop settings" : "server environment"}.`
              : "Connect your own Gemini key for the conversational assistant."}
          </small>
        </span>
      </div>
      {status?.canConfigure ? (
        <>
          <Field
            label="Gemini API key"
            hint="Kept in your private ACE configuration folder with owner-only permissions. It is never returned to the browser or stored in browser preferences."
          >
            <input
              aria-label="Gemini API key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                status.configured
                  ? "Enter a new key to replace the saved key"
                  : "Paste your Gemini API key"
              }
              maxLength={256}
            />
          </Field>
          <Field
            label="Gemini model"
            hint="Choose a structured-output model available to your account. Provider quota or billing limits still apply."
          >
            <input
              aria-label="Gemini model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gemini-2.5-flash"
              maxLength={80}
              list="ace-models"
            />
            <datalist id="ace-models">
              <option value="gemini-2.5-flash" />
              <option value="gemini-2.5-pro" />
            </datalist>
          </Field>
          {status.source === "environment" && (
            <p className="settings-help">
              The server environment key takes priority over saved desktop
              settings.
            </p>
          )}
          <div className="settings-buttons">
            <button
              className="btn primary small"
              disabled={busy || (!key && !status.configured)}
              onClick={() => void save(false)}
            >
              {busy ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <ShieldCheck size={14} />
              )}
              Save securely
            </button>
            <button
              className="btn secondary small"
              disabled={busy || (!key && !status.configured)}
              onClick={() => void save(true)}
            >
              Save & test connection
            </button>
          </div>
        </>
      ) : (
        <div className="privacy-note">
          <ShieldCheck size={18} />
          <span>
            Open ACE Studio from its installed desktop icon to configure Gemini
            here. For a source/server installation, set GEMINI_API_KEY in
            .env.local and restart the server. No key is needed for local
            document tools.
          </span>
        </div>
      )}
      {desktop && (
        <div className="desktop-stop">
          <p>
            Closing the browser tab leaves the local service running. Use this
            button when you want to stop ACE Studio completely.
          </p>
          <button
            className="btn secondary small"
            onClick={async () => {
              const response = await fetch("/api/desktop", { method: "POST" });
              if (response.ok)
                notify(
                  "ACE Studio is stopping. Click its desktop icon to open it again.",
                );
              else notify("The desktop service could not be stopped.", true);
            }}
          >
            <Power size={14} />
            Stop desktop service
          </button>
        </div>
      )}
    </section>
  );
}
