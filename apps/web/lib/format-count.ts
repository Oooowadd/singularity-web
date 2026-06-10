export function formatFollowerCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function followerNoun(platform: "youtube" | "xhs"): string {
  return platform === "xhs" ? "粉丝" : "订阅";
}
