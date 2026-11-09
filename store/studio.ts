"use client";
import { create } from "zustand";
import { get, set, del } from "idb-keyval";
import { defaultPlan } from "@/lib/plan";
import type { Plan } from "@/lib/plan";
import type { ImageItem } from "@/lib/client";
export interface Preferences {
  theme: "dark" | "light" | "system";
  format: Plan["format"];
  quality: Plan["qualityPreference"];
  preserveAspectRatio: boolean;
  allowUpscaling: boolean;
  preserveTransparency: boolean;
  background: string;
  retainMetadata: boolean;
  language: "en" | "ur" | "de";
  filenamePattern: string;
  confirmPlan: boolean;
}
export const defaultPrefs: Preferences = {
  theme: "dark",
  format: "original",
  quality: "high",
  preserveAspectRatio: true,
  allowUpscaling: false,
  preserveTransparency: true,
  background: "#FFFFFF",
  retainMetadata: false,
  language: "en",
  filenamePattern: "{name}_processed",
  confirmPlan: true,
};
export interface HistoryEntry {
  id: string;
  time: number;
  label: string;
  plan: Plan;
}
interface Studio {
  items: ImageItem[];
  selected: string | null;
  plan: Plan;
  past: Plan[];
  future: Plan[];
  history: HistoryEntry[];
  preferences: Preferences;
  hydrated: boolean;
  presets: { name: string; plan: Plan }[];
  chats: { role: "user" | "assistant"; text: string }[];
  questions: string[];
  mode: "ai" | "offline";
  setPlan: (p: Plan, label?: string) => void;
  undo: () => void;
  redo: () => void;
  updateItem: (id: string, p: Partial<ImageItem>) => void;
  addItems: (items: ImageItem[]) => void;
  remove: (id: string) => void;
  select: (id: string) => void;
  clear: () => void;
  setQuestions: (q: string[]) => void;
  setMode: (m: "ai" | "offline") => void;
  chat: (role: "user" | "assistant", text: string) => void;
  prefs: (p: Partial<Preferences>) => void;
  hydrate: () => Promise<void>;
  resetPrefs: () => void;
  savePreset: (name: string) => void;
  deletePreset: (name: string) => void;
  clearHistory: () => void;
}
function revoke(item: ImageItem) {
  if (item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
  if (item.result) URL.revokeObjectURL(item.result.url);
}
export const useStudio = create<Studio>((setState, getState) => ({
  items: [],
  selected: null,
  plan: { ...defaultPlan },
  past: [],
  future: [],
  history: [],
  preferences: defaultPrefs,
  hydrated: false,
  presets: [],
  chats: [],
  questions: [],
  mode: "offline",
  setPlan: (plan, label = "Settings updated") =>
    setState((s) => ({
      plan: { ...plan },
      past: [...s.past, s.plan].slice(-30),
      future: [],
      questions: [],
      history: [
        { id: crypto.randomUUID(), time: Date.now(), label, plan: { ...plan } },
        ...s.history,
      ].slice(0, 30),
    })),
  undo: () =>
    setState((s) =>
      s.past.length
        ? {
            plan: s.past.at(-1)!,
            past: s.past.slice(0, -1),
            future: [s.plan, ...s.future],
            questions: [],
          }
        : {},
    ),
  redo: () =>
    setState((s) =>
      s.future.length
        ? {
            plan: s.future[0],
            past: [...s.past, s.plan],
            future: s.future.slice(1),
            questions: [],
          }
        : {},
    ),
  updateItem: (id, p) =>
    setState((s) => ({
      items: s.items.map((item) => {
        if (item.id !== id) return item;
        if (p.result && item.result) URL.revokeObjectURL(item.result.url);
        return { ...item, ...p };
      }),
    })),
  addItems: (items) =>
    setState((s) => ({
      items: [...s.items, ...items],
      selected: s.selected ?? items[0]?.id ?? null,
    })),
  remove: (id) =>
    setState((s) => {
      const item = s.items.find((i) => i.id === id);
      if (item) revoke(item);
      const items = s.items.filter((i) => i.id !== id);
      return {
        items,
        selected: s.selected === id ? (items[0]?.id ?? null) : s.selected,
      };
    }),
  select: (selected) => setState({ selected }),
  clear: () => {
    getState().items.forEach(revoke);
    setState({
      items: [],
      selected: null,
      plan: { ...defaultPlan },
      past: [],
      future: [],
      history: [],
      chats: [],
      questions: [],
    });
  },
  setQuestions: (questions) => setState({ questions }),
  setMode: (mode) => setState({ mode }),
  chat: (role, text) =>
    setState((s) => ({ chats: [...s.chats, { role, text }].slice(-20) })),
  prefs: (p) => {
    const preferences = { ...getState().preferences, ...p };
    setState({ preferences });
    void set("pixelforge-preferences", preferences).catch(() => {});
  },
  hydrate: async () => {
    if (getState().hydrated) return;
    try {
      const [saved, presets] = await Promise.all([
        get("pixelforge-preferences"),
        get("pixelforge-presets"),
      ]);
      const preferences = { ...defaultPrefs, ...saved };
      // Preferences contain no images, prompts, credentials or processing results.
      setState({
        preferences,
        presets: Array.isArray(presets) ? presets : [],
        hydrated: true,
        plan: {
          ...defaultPlan,
          format: preferences.format,
          quality:
            preferences.quality === "small"
              ? 60
              : preferences.quality === "balanced"
                ? 80
                : 88,
          qualityPreference: preferences.quality,
          resizeMode: preferences.preserveAspectRatio ? "contain" : "fill",
          preserveAspectRatio: preferences.preserveAspectRatio,
          allowUpscaling: preferences.allowUpscaling,
          preserveTransparency: preferences.preserveTransparency,
          background: preferences.background,
          retainMetadata: preferences.retainMetadata,
        },
      });
    } catch {
      setState({ hydrated: true });
    }
  },
  resetPrefs: () => {
    setState({ preferences: { ...defaultPrefs }, presets: [] });
    void Promise.all([
      del("pixelforge-preferences"),
      del("pixelforge-presets"),
    ]).catch(() => {});
  },
  savePreset: (name) => {
    const presets = [
      ...getState().presets.filter((p) => p.name !== name),
      { name, plan: { ...getState().plan } },
    ].slice(-20);
    setState({ presets });
    void set("pixelforge-presets", presets).catch(() => {});
  },
  deletePreset: (name) => {
    const presets = getState().presets.filter((p) => p.name !== name);
    setState({ presets });
    void set("pixelforge-presets", presets).catch(() => {});
  },
  clearHistory: () => setState({ history: [] }),
}));
