"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Mode = "light" | "dark" | "system";
const STORAGE_KEY = "vyral-color-mode";

function applyMode(mode: Mode) {
  const resolved = mode === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : mode;
  if (resolved === "light") {
    document.documentElement.setAttribute("data-mode", "light");
  } else {
    document.documentElement.removeAttribute("data-mode");
  }
}

export function useColorMode() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "system";
    setMode(stored);
    applyMode(stored);

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const current = (localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "system";
      if (current === "system") applyMode("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function setColorMode(next: Mode) {
    localStorage.setItem(STORAGE_KEY, next);
    setMode(next);
    applyMode(next);
  }

  return { mode, setColorMode };
}

export function ColorModeToggle() {
  const { mode, setColorMode } = useColorMode();

  const options: { value: Mode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Color mode">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={mode === value}
          onClick={() => setColorMode(value)}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border transition-colors ${
            mode === value ? "border-crimson text-offwhite" : "border-charcoal text-steel"
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
