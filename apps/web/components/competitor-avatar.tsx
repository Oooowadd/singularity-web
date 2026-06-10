"use client";

import { useState } from "react";

// Plain <img> on purpose: avatars come from XHS/YouTube CDNs (no next/image
// remotePatterns needed) and XHS blocks hotlinking with a referrer.
export function CompetitorAvatar({
  name,
  avatarUrl,
  className = "size-7",
}: {
  name: string | null;
  avatarUrl: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "?";
  if (!avatarUrl || failed) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full border bg-muted font-medium text-[10px] text-muted-foreground ${className}`}
      >
        {initial}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt={name ?? "头像"}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full border object-cover ${className}`}
    />
  );
}
