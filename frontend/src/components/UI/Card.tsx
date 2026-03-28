"use client";

import { motion } from "framer-motion";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  animate?: boolean;
}

export function Card({ children, className = "", onClick, animate = true }: CardProps) {
  const Comp = animate ? motion.div : "div";
  return (
    <Comp
      {...(animate ? { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } } : {})}
      onClick={onClick}
      className={`glass rounded-2xl p-4 cursor-pointer ${className}`}
    >
      {children}
    </Comp>
  );
}
