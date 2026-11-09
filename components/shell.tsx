"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Sparkles,
  Layers3,
  Settings2,
  Sun,
  Moon,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { useStudio } from "@/store/studio";
import { ToastProvider } from "./ui";
export function Logo() {
  return (
    <span className="brand">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <defs>
          <linearGradient id="brand-gradient" x2="1" y2="1">
            <stop stopColor="#c1a1ff" />
            <stop offset="1" stopColor="#6962ff" />
          </linearGradient>
        </defs>
        <path
          d="M18 2 33 10.5v15L18 34 3 25.5v-15Z"
          fill="url(#brand-gradient)"
        />
        <path
          d="m10 25 8-16 8 16M13.4 19h9.2"
          fill="none"
          stroke="#17152c"
          strokeWidth="3.1"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span>
        ACE<span className="brand-ai">STUDIO</span>
      </span>
    </span>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    [menu, setMenu] = useState(false);
  const prefs = useStudio((s) => s.preferences),
    changePrefs = useStudio((s) => s.prefs),
    hydrate = useStudio((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [hydrate]);
  useEffect(() => {
    const m = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const theme =
        prefs.theme === "system" ? (m.matches ? "dark" : "light") : prefs.theme;
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("pixelforge-theme", prefs.theme);
    };
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, [prefs.theme]);
  const links = [
    { href: "/", label: "All tools", icon: LayoutDashboard },
    { href: "/studio", label: "Image studio", icon: Sparkles },
    { href: "/tools/workflow", label: "Workflows", icon: Layers3 },
    { href: "/settings", label: "Settings", icon: Settings2 },
  ];
  return (
    <ToastProvider>
      <header className="nav">
        <Link className="logo-link" href="/" aria-label="ACE Studio home">
          <Logo />
        </Link>
        <nav
          className={menu ? "nav-links open" : "nav-links"}
          aria-label="Main navigation"
        >
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              onClick={() => setMenu(false)}
              href={href}
              key={href}
              className={pathname === href ? "active" : ""}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="nav-right">
          <span className="private-label">
            <ShieldCheck size={14} />
            Private by design
          </span>
          <button
            className="icon-btn"
            aria-label="Toggle light and dark theme"
            onClick={() =>
              changePrefs({
                theme:
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark",
              })
            }
          >
            {prefs.theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button
            className="icon-btn mobile-menu"
            aria-label="Toggle menu"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      {children}
      <footer>
        <span>
          ACE Studio <span className="footer-dot">·</span> Every file. One
          workspace.
        </span>
        <span>
          <ShieldCheck size={13} />
          Original files stay yours. Document jobs are cleaned up automatically.
        </span>
      </footer>
    </ToastProvider>
  );
}
