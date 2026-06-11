// Run display labels shared by the active-runs banner and the global indicator —
// a new task id must be added here exactly once.
export const AGENT_LABEL: Record<string, string> = {
  clerk: "Clerk",
  muse: "Muse",
  poet: "Poet",
};

export const COMMAND_LABEL: Record<string, string> = {
  "clerk-analyze-channel": "频道分析",
  "clerk-detect-channel-series": "系列归类",
  "muse-monitor-competitors": "巡视对标",
  "poet-generate-bible": "频道圣经",
  "poet-analyze-custom-topic": "选题拆解",
  "poet-generate-script": "脚本生成",
};
