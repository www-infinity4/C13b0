"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Infinity, Zap } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/spark", label: "Infinity Spark" },
  { href: "/business", label: "Build a Business" },
  { href: "/research", label: "Research" },
  { href: "/hydrogen-host", label: "Hydrogen Host" },
  { href: "/visualizer", label: "3D Visualizer" },
  { href: "/game", label: "∞ Game" },
];

export default function Navigation() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-300/20 bg-[#020504]/95 backdrop-blur-xl"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group" aria-label="Infinity OS home">
            <div className="relative">
              <Infinity
                className="w-7 h-7 text-emerald-300 group-hover:text-white transition-colors"
                aria-hidden="true"
              />
              <Zap
                className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400"
                aria-hidden="true"
              />
            </div>
            <span className="font-serif text-lg font-black text-white">Infinity <span className="text-emerald-300">OS</span></span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1" role="list">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/65 hover:text-emerald-200 hover:bg-emerald-300/10 transition-all duration-200"
                role="listitem"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/business"
              className="px-4 py-2 rounded-lg bg-emerald-300 text-[#00150b] text-sm font-black hover:bg-white transition-all"
              aria-label="Build an Infinity business page"
            >
              Start a Business
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-300/10"
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
                  className="px-4 py-3 rounded-lg text-sm font-medium text-white/65 hover:text-emerald-200 hover:bg-emerald-300/10 transition-all"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/business"
                onClick={() => setOpen(false)}
                className="mt-2 px-4 py-3 rounded-lg bg-emerald-300 text-[#00150b] text-sm font-black text-center"
              >
                Start a Business
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
