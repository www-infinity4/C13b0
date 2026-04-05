"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Infinity, Zap } from "lucide-react";

const navLinks = [
  { href: "/", label: "Gallery" },
  { href: "/research", label: "Research" },
  { href: "/hydrogen-host", label: "Hydrogen Host" },
  { href: "/visualizer", label: "3D Visualizer" },
  { href: "/game", label: "∞ Game" },
];

export default function Navigation() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-purple-800/30"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group" aria-label="Infinity OS home">
            <div className="relative">
              <Infinity
                className="w-7 h-7 text-purple-400 group-hover:text-cyan-400 transition-colors"
                aria-hidden="true"
              />
              <Zap
                className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400"
                aria-hidden="true"
              />
            </div>
            <span className="font-bold text-lg shimmer-text">Infinity OS</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1" role="list">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium text-purple-200 hover:text-white hover:bg-purple-800/40 transition-all duration-200"
                role="listitem"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/hydrogen-host"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-sm font-semibold hover:from-purple-500 hover:to-cyan-500 transition-all glow-pulse"
              aria-label="Get your free emoji ID"
            >
              Get Free ID 🌐
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-purple-300 hover:text-white hover:bg-purple-800/40"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div
            id="mobile-menu"
            className="md:hidden pb-4"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-purple-200 hover:text-white hover:bg-purple-800/40 transition-all"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/hydrogen-host"
                onClick={() => setOpen(false)}
                className="mt-2 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-sm font-semibold text-center"
              >
                Get Free ID 🌐
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
