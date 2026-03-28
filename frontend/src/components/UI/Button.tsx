"use client";

import { motion } from "framer-motion";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base = "font-semibold rounded-2xl transition-all duration-200 active:scale-95";
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/30",
    secondary: "glass text-white hover:bg-white/20",
    ghost: "text-white/70 hover:text-white hover:bg-white/10",
  };
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
