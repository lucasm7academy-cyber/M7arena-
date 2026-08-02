'use client';

import React, { ReactNode } from 'react';
import { motion } from 'motion/react';

/**
 * VipCrown SVG Icon
 * Golden crown with gems
 */
export function VipCrown() {
  return (
    <svg
      width="24"
      height="20"
      viewBox="0 0 24 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute -top-2 left-1/2 -translate-x-1/2"
    >
      {/* Crown base */}
      <path
        d="M2 18H22V20H2V18Z"
        fill="currentColor"
        className="text-primary"
      />
      {/* Crown peaks */}
      <path
        d="M4 12L6 4L8 10L12 2L16 10L18 4L20 12"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        className="text-primary"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Crown gems */}
      <circle cx="6" cy="6" r="1.5" fill="currentColor" className="text-primary" />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" className="text-primary" />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" className="text-primary" />
    </svg>
  );
}

/**
 * VipBorder: Wrapper with animated RGB border
 * Use as outer container for cards/avatars
 */
interface VipBorderProps {
  children: ReactNode;
  className?: string;
}

export function VipBorder({ children, className = '' }: VipBorderProps) {
  return (
    <motion.div
      className={`relative ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Animated border - Primary color (#FFB800) with slow rotation */}
      <div
        className="absolute inset-0 rounded-inherit p-0.5"
        style={{
          background: 'conic-gradient(from 0deg, #FFB800, #FFD700, #FFB800)',
          borderRadius: 'inherit',
          animation: 'vip-border-rotate 8s linear infinite',
        }}
      >
        {/* Inner content */}
        <div
          className="h-full w-full rounded-inherit bg-[#050505]"
          style={{ borderRadius: 'inherit' }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes vip-border-rotate {
          0% {
            filter: hue-rotate(0deg);
          }
          100% {
            filter: hue-rotate(360deg);
          }
        }
      `}</style>
    </motion.div>
  );
}

/**
 * VipLabel: Badge text
 */
interface VipLabelProps {
  text?: string;
  className?: string;
}

export function VipLabel({ text = 'VIP', className = '' }: VipLabelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`px-2 py-1 bg-gradient-to-r from-primary to-pink-500 rounded-full text-black text-xs font-black uppercase tracking-widest ${className}`}
    >
      {text}
    </motion.div>
  );
}

/**
 * VipCard: Complete VIP indicator for player cards
 * Combines border + crown + label
 */
interface VipCardProps {
  children: ReactNode;
  showCrown?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function VipCard({
  children,
  showCrown = true,
  showLabel = false,
  className = '',
}: VipCardProps) {
  return (
    <div className={`relative ${className}`}>
      <VipBorder className="h-full w-full rounded-2xl">
        {showCrown && <VipCrown />}
        <div className={showLabel ? 'pt-6' : ''}>{children}</div>
      </VipBorder>
      {showLabel && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
          <VipLabel />
        </div>
      )}
    </div>
  );
}
