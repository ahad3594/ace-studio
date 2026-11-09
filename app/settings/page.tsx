"use client";
import {
  Monitor,
  Palette,
  SlidersHorizontal,
  ShieldCheck,
  Download,
  RotateCcw,
} from "lucide-react";
import { useStudio } from "@/store/studio";
import type { Preferences } from "@/store/studio";
import { Field, Switch, useToast } from "@/components/ui";
import { ProviderSettings } from "@/components/provider-settings";
export default function Settings() {
  const {
      preferences: p,
      prefs,
      resetPrefs,
      clear,
      clearHistory,
    } = useStudio(),
    notify = useToast();
  return (
    <main className="settings-page">
      <section className="page-intro">
        <span className="eyebrow">MAKE YOURSELF AT HOME</span>
        <h1>Your studio. Your way.</h1>
        <p>Thoughtful defaults for a smoother creative flow.</p>
      </section>
      <div className="settings-grid">
        <ProviderSettings />
        <section className="panel settings-card">
          <h2>
            <Palette size={20} />
            Appearance
          </h2>
          <Field label="Theme">
            <select
              value={p.theme}
              onChange={(e) =>
                prefs({ theme: e.target.value as Preferences["theme"] })
              }
            >
              <option value="dark">Dark · Obsidian</option>
              <option value="light">Light · Porcelain</option>
              <option value="system">Follow system</option>
            </select>
          </Field>
          <Field
            label="Assistant input language"
            hint="Prompt suggestions and input hints adapt to this language. All four supported languages are always accepted."
          >
            <select
              value={p.language}
              onChange={(e) =>
                prefs({ language: e.target.value as Preferences["language"] })
              }
            >
              <option value="en">English / Roman Urdu</option>
              <option value="ur">اردو</option>
              <option value="de">Deutsch</option>
            </select>
          </Field>
        </section>
        <section className="panel settings-card">
          <h2>
            <SlidersHorizontal size={20} />
            Image defaults
          </h2>
          <p className="setting-help">
            These defaults apply when opening a new session. Current settings
            remain editable in the studio.
          </p>
          <div className="field-grid two">
            <Field label="Output format">
              <select
                value={p.format}
                onChange={(e) =>
                  prefs({ format: e.target.value as Preferences["format"] })
                }
              >
                {["original", "jpeg", "png", "webp", "avif"].map((f) => (
                  <option key={f} value={f}>
                    {f === "original" ? "Original" : f.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quality">
              <select
                value={p.quality}
                onChange={(e) =>
                  prefs({ quality: e.target.value as Preferences["quality"] })
                }
              >
                <option value="high">Maximum quality</option>
                <option value="balanced">Balanced</option>
                <option value="small">Maximum compression</option>
              </select>
            </Field>
          </div>
          <Switch
            label="Preserve aspect ratio"
            checked={p.preserveAspectRatio}
            onChange={(v) => prefs({ preserveAspectRatio: v })}
          />
          <Switch
            label="Allow upscaling"
            checked={p.allowUpscaling}
            onChange={(v) => prefs({ allowUpscaling: v })}
          />
          <Switch
            label="Preserve transparency"
            checked={p.preserveTransparency}
            onChange={(v) => prefs({ preserveTransparency: v })}
          />
          <Field label="Default background color">
            <input
              type="color"
              value={p.background}
              onChange={(e) => prefs({ background: e.target.value })}
            />
          </Field>
        </section>
        <section className="panel settings-card">
          <h2>
            <Download size={20} />
            Workflow & downloads
          </h2>
          <Field
            label="Filename pattern"
            hint="Use {name} for the original name and {index} for the image number. Extensions are added automatically."
          >
            <input
              value={p.filenamePattern}
              maxLength={100}
              onChange={(e) => prefs({ filenamePattern: e.target.value })}
            />
          </Field>
          <Switch
            label="Review plan before processing"
            hint="When disabled, clear instructions generate automatically after analysis."
            checked={p.confirmPlan}
            onChange={(v) => prefs({ confirmPlan: v })}
          />
          <div className="shortcuts">
            <h3>Keyboard shortcuts</h3>
            <div>
              <span>Upload images</span>
              <kbd>Ctrl / ⌘ O</kbd>
            </div>
            <div>
              <span>Generate images</span>
              <kbd>Ctrl / ⌘ ↵</kbd>
            </div>
            <div>
              <span>Download selected result</span>
              <kbd>Ctrl / ⌘ D</kbd>
            </div>
            <div>
              <span>Close expanded panels</span>
              <kbd>Esc</kbd>
            </div>
          </div>
        </section>
        <section className="panel settings-card">
          <h2>
            <ShieldCheck size={20} />
            Privacy & session
          </h2>
          <p className="setting-help">
            Files are held in memory and are not saved to disk by the
            application. Only text instructions go to Gemini when it is
            configured. Preferences and presets are saved on this device.
          </p>
          <Switch
            label="Retain image metadata"
            hint="Off by default. Enabling this can preserve sensitive EXIF fields such as GPS location."
            checked={p.retainMetadata}
            onChange={(v) => prefs({ retainMetadata: v })}
          />
          <div className="settings-buttons">
            <button
              className="btn secondary small"
              onClick={() => {
                clearHistory();
                notify("History cleared.");
              }}
            >
              Clear history
            </button>
            <button
              className="btn secondary small"
              onClick={() => {
                clear();
                notify("Session cleared.");
              }}
            >
              Clear session
            </button>
            <button
              className="btn secondary small"
              onClick={() => {
                resetPrefs();
                notify("Preferences and saved presets cleared.");
              }}
            >
              <RotateCcw size={14} />
              Reset preferences
            </button>
          </div>
          <div className="privacy-note">
            <Monitor size={17} />
            <span>
              Gemini is configured securely on the server. API keys never appear
              in this page.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
