"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Trophy, User, Camera } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/sfida", icon: Camera, label: "Sfida" },
  { href: "/territorio", icon: Map, label: "Mappa" },
  { href: "/quiz-live", icon: Trophy, label: "Quiz" },
  { href: "/profilo", icon: User, label: "Profilo" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 glass-dark">
      <div className="flex justify-around items-center py-2 px-4">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
                active
                  ? "text-primary bg-primary/10"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
