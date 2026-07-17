export const PLATFORM_LABEL = { youtube: "YouTube", xhs: "小红书", douyin: "抖音" } as const;
export type Platform = keyof typeof PLATFORM_LABEL;
