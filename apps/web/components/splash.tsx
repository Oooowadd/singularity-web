"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  redirectTo: string;
  duration?: number;
};

export function Splash({ redirectTo, duration = 1500 }: Props) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(redirectTo);
    }, duration);
    return () => clearTimeout(timer);
  }, [router, redirectTo, duration]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-12">
        <h1 className="font-display text-7xl leading-none select-none sm:text-8xl">
          Singularity.
        </h1>
        <svg
          viewBox="0 0 200 100"
          className="w-56 overflow-visible sm:w-64"
          fill="none"
          aria-hidden
        >
          <path
            className="splash-line splash-line-clerk"
            d="M10,80 C40,80 60,20 100,50 C140,80 160,20 190,20"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            className="splash-line splash-line-muse"
            d="M10,20 C40,20 60,80 100,50 C140,20 160,80 190,80"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            className="splash-line splash-line-poet"
            d="M10,50 C50,10 150,90 190,50"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <div className="flex gap-2">
          <span className="splash-dot splash-dot-1 size-2 rounded-full bg-clerk" />
          <span className="splash-dot splash-dot-2 size-2 rounded-full bg-muse" />
          <span className="splash-dot splash-dot-3 size-2 rounded-full bg-poet" />
        </div>
      </div>
    </div>
  );
}
