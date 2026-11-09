"use client";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  HardDrive,
  MousePointer2,
  ImageIcon,
  Sparkles,
  SlidersHorizontal,
  Layers3,
  Star,
  FileText,
  Command,
} from "lucide-react";
import { tools, categories } from "@/lib/documents/catalog";
import type { Category } from "@/lib/documents/catalog";
import { ToolIcon } from "./icons";
import { CommandBox } from "./command";
const imageTools = [
  {
    title: "AI image studio",
    description:
      "Resize, compress and convert images by describing the result.",
    icon: Sparkles,
    prompt: "",
  },
  {
    title: "Resize images",
    description: "Precise pixels, proportions and physical dimensions.",
    icon: SlidersHorizontal,
    prompt: "Resize to 600x600 without cropping",
  },
  {
    title: "Compress images",
    description: "Aim for a file-size limit and inspect the actual bytes.",
    icon: ImageIcon,
    prompt: "Compress below 100KB",
  },
  {
    title: "Batch image processing",
    description: "One image instruction. A whole folder of results.",
    icon: Layers3,
    prompt: "",
  },
];
export function ToolHub() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState<Category>("All tools"),
    [favorites, setFavorites] = useState<string[]>([]),
    [favoriteOnly, setFavoriteOnly] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ace-favorites") || "[]");
      if (Array.isArray(saved))
        setFavorites(saved.filter((v) => typeof v === "string"));
    } catch {}
  }, []);
  function favorite(slug: string) {
    setFavorites((previous) => {
      const next = previous.includes(slug)
        ? previous.filter((v) => v !== slug)
        : [...previous, slug];
      localStorage.setItem("ace-favorites", JSON.stringify(next));
      return next;
    });
  }
  const visible = useMemo(
    () =>
      tools.filter(
        (t) =>
          (category === "All tools" || category === t.category) &&
          (!favoriteOnly || favorites.includes(t.slug)) &&
          `${t.title} ${t.description} ${t.category}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [category, query, favoriteOnly, favorites],
  );
  return (
    <main className="ace-home">
      <section className="ace-hero">
        <div className="ace-hero-copy">
          <span className="ace-kicker">
            <span />
            YOUR EVERYDAY FILE WORKSPACE
          </span>
          <h1>
            Your files.
            <br />
            <span>All the possibilities.</span>
          </h1>
          <p>
            Documents, images, and a little intelligence.
            <br />
            Everything you need, together in ACE Studio.
          </p>
          <div className="ace-hero-actions">
            <a className="btn primary" href="#all-tools">
              Find your tool
              <ArrowRight size={16} />
            </a>
            <Link className="btn subtle" href="/studio">
              Open image studio
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="ace-trust">
            <span>
              <ShieldCheck size={14} />
              Private by design
            </span>
            <span>
              <HardDrive size={14} />
              Runs on your machine
            </span>
            <span>
              <MousePointer2 size={14} />
              No subscription to local tools
            </span>
          </div>
        </div>
        <div className="ace-hero-visual" aria-hidden="true">
          <div className="ace-orbit o1" />
          <div className="ace-orbit o2" />
          <div className="ace-file-card file-behind">
            <span className="file-tab">DOCX</span>
            <div className="mini-lines">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="ace-file-card file-front">
            <div className="hero-file-icon">
              <FileText size={30} />
            </div>
            <span className="file-tab">PDF</span>
            <div className="mini-lines">
              <i />
              <i />
              <i />
            </div>
            <div className="file-ready">
              <span />
              Ready for what’s next.
            </div>
          </div>
          <div className="ace-floating-command">
            <Sparkles size={15} />
            <span>“Make it work for me.”</span>
            <Command size={13} />
          </div>
          <span className="hero-star s1">✦</span>
          <span className="hero-star s2">✦</span>
          <span className="hero-dot" />
        </div>
      </section>
      <CommandBox />
      <section id="all-tools" className="ace-tool-directory">
        <div className="directory-heading">
          <div>
            <span className="ace-kicker">A TOOL FOR EVERY NEXT STEP</span>
            <h2>What are we working on?</h2>
          </div>
          <label className="tool-search">
            <Search size={16} />
            <input
              aria-label="Search tools"
              placeholder="Find a tool…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>⌕</kbd>
          </label>
        </div>
        <div className="tool-filter-row">
          <div
            className="category-tabs"
            role="group"
            aria-label="Tool categories"
          >
            {categories.map((c) => (
              <button
                key={c}
                className={c === category ? "selected" : ""}
                aria-pressed={c === category}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            className={`favorite-filter ${favoriteOnly ? "selected" : ""}`}
            aria-label="Show favorite tools"
            aria-pressed={favoriteOnly}
            onClick={() => setFavoriteOnly(!favoriteOnly)}
          >
            <Star size={15} />
            <span>Favorites</span>
          </button>
        </div>
        <div className="tool-grid">
          {visible.map((tool) => (
            <article className={`tool-card tone-${tool.color}`} key={tool.slug}>
              <Link href={"/tools/" + tool.slug} className="tool-card-link">
                <span className="tool-icon">
                  <ToolIcon name={tool.icon} />
                </span>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
                <span className="tool-card-arrow">
                  <ArrowUpRight size={16} />
                </span>
              </Link>
              <button
                className={`tool-favorite ${favorites.includes(tool.slug) ? "is-favorite" : ""}`}
                aria-label={`${favorites.includes(tool.slug) ? "Unfavorite" : "Favorite"} ${tool.title}`}
                onClick={() => favorite(tool.slug)}
              >
                <Star
                  size={14}
                  fill={favorites.includes(tool.slug) ? "currentColor" : "none"}
                />
              </button>
            </article>
          ))}
        </div>
        {!visible.length && (
          <div className="no-tools">
            <Search size={24} />
            <h3>No tools match this search.</h3>
            <p>Try another word or choose a different category.</p>
            <button
              className="text-button"
              onClick={() => {
                setQuery("");
                setCategory("All tools");
                setFavoriteOnly(false);
              }}
            >
              Show all tools
            </button>
          </div>
        )}
      </section>
      <section className="image-tool-section">
        <div className="directory-heading">
          <div>
            <span className="ace-kicker">PIXELS HAVE A PLACE HERE, TOO</span>
            <h2>A sharper image workflow.</h2>
          </div>
          <Link href="/studio" className="text-button">
            Explore image studio
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="image-tools-grid">
          {imageTools.map(({ title, description, icon: Icon, prompt }, i) => (
            <Link
              href={
                i === 3
                  ? "/batch"
                  : "/studio" +
                    (prompt ? "?prompt=" + encodeURIComponent(prompt) : "")
              }
              className="image-tool-card"
              key={title}
            >
              <Icon size={22} />
              <h3>{title}</h3>
              <p>{description}</p>
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </div>
      </section>
      <section className="ace-privacy-band">
        <span className="privacy-emblem">
          <ShieldCheck size={28} />
        </span>
        <div>
          <h2>Powerful tools. A private workspace.</h2>
          <p>
            Document jobs use private temporary folders that are removed after
            processing. AI document text is shared only when you explicitly
            allow it.
          </p>
        </div>
        <Link href="/settings">
          Your settings
          <ArrowUpRight size={14} />
        </Link>
      </section>
    </main>
  );
}
