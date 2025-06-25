"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={`w-10 h-6 ${className}`} />;
  }

  const isDark = theme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full 
        transition-colors duration-200 ease-in-out 
        focus-visible:outline-none focus-visible:ring-2 
        focus-visible:ring-primary/50 focus-visible:ring-offset-2
        focus-visible:ring-offset-bg
        ${isDark ? "bg-surface-2" : "bg-surface-2"}
        ${className}
      `}
      aria-label="Toggle theme"
    >
      <span className="sr-only">Toggle theme</span>
      <span
        className={`
          pointer-events-none absolute left-0 inline-flex h-5 w-5 
          transform items-center justify-center rounded-full 
          bg-surface shadow-lg ring-0 transition-transform duration-200 ease-in-out
          ${isDark ? "translate-x-5" : "translate-x-1"}
        `}
      >
        {isDark ? (
          <Moon className="h-3 w-3 text-muted" />
        ) : (
          <Sun className="h-3 w-3 text-muted" />
        )}
      </span>
    </button>
  );
}
