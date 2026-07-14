// Beta survey question set (题目设计方案 v2) — shared by the /apply stepper, the
// server-side zod check, and the admin summary. Editing questions: bump
// SURVEY_VERSION, never the DB.

export const SURVEY_VERSION = 2;

export type SurveyQuestion = {
  id: string;
  type: "single" | "multi";
  title: string;
  hint?: string;
  options: string[];
  // Renders an "其他（请注明）" choice with an inline input, stored as `${id}_other`.
  allowOther?: boolean;
  required?: boolean;
  // Multi only: hard cap on selections.
  maxSelect?: number;
  // Multi only: picking this option clears the rest (and vice versa).
  exclusiveOption?: string;
};

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "role",
    type: "single",
    title: "你目前主要的创作身份是？",
    options: [
      "影视 / 短剧从业者（导演、制片、剪辑等）",
      "AI 短片 / MV / 广告片创作者",
      "MCN 从业者",
      "内容行业编导",
      "内容行业操盘手",
      "自媒体创作者",
      "设计类视觉创作者",
    ],
    allowOther: true,
    required: true,
  },
  {
    id: "ai_hours",
    type: "single",
    title: "过去 3 个月，你平均每周花多少时间在 AI 内容创作工具上？",
    options: [
      "几乎没用过",
      "偶尔玩玩，每周 2 小时以内",
      "每周 2-10 小时，会拿来做点正经的事",
      "每周 >10 小时，已经离不开这些工具",
    ],
    required: true,
  },
  {
    id: "workload",
    type: "multi",
    title: "在内容生产环节中，你目前投入的精力/时间最多、最希望被“减负”的是？",
    hint: "最多选 3 项",
    options: [
      "选题调研与灵感捕捉",
      "脚本 / 文案撰写",
      "拍摄执行与素材整理",
      "剪辑与后期制作",
      "标题 / 封面 / 标签优化",
      "多平台排期与分发",
      "数据复盘与效果分析",
      "团队协作与进度管理",
    ],
    required: true,
    maxSelect: 3,
  },
  {
    id: "pains",
    type: "multi",
    title: "以下这些场景，哪些是你真的经历过、并且真的烦过的？",
    hint: "如果都没有可以全不选",
    options: [
      "跨工具反复切换，创作流总被打断",
      "素材存了但管理混乱，经常找不到",
      "文件太大、太多、跨端同步速度慢",
      "自己的创作成果被拿去训练模型或移作他用",
      "以上痛点基本没遇到过",
    ],
    allowOther: true,
    exclusiveOption: "以上痛点基本没遇到过",
  },
  {
    id: "commitment",
    type: "single",
    title: "如果我们邀请你参与内测，你愿意参与的程度大概是？",
    options: [
      "我只是好奇看看",
      "我可以试用，顺手填一份简短反馈",
      "我愿意深度参与产品迭代，持续反馈和参与共创和访谈",
    ],
    required: true,
  },
];

// Admin list shows these inline; the rest appear in the expanded view.
export const SUMMARY_QUESTION_IDS = ["role", "ai_hours", "commitment"];

export function questionTitle(id: string): string {
  const base = id.endsWith("_other") ? id.slice(0, -"_other".length) : id;
  const q = SURVEY_QUESTIONS.find((x) => x.id === base);
  if (!q) return id;
  return id.endsWith("_other") ? `${q.title}（其他）` : q.title;
}
