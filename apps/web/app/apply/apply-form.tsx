"use client";

import { ArrowLeft, ArrowRight, Check, Clock3, ListChecks, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SURVEY_QUESTIONS, SURVEY_VERSION, type SurveyQuestion } from "@/lib/beta-survey";
import { trpc } from "@/lib/trpc";

type Answers = Record<string, string | string[]>;
type Phase = "intro" | number | "contact" | "success";

const OTHER = "其他";
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function ApplyForm() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<Answers>({});
  const [email, setEmail] = useState("");
  const [wechat, setWechat] = useState("");
  const [social, setSocial] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const submit = trpc.access.submitBetaApplication.useMutation({
    onSuccess: () => setPhase("success"),
  });

  const totalSteps = SURVEY_QUESTIONS.length + 1; // + contact
  const stepIndex = phase === "contact" ? totalSteps : typeof phase === "number" ? phase + 1 : 0;

  const setAnswer = (id: string, value: string | string[]) =>
    setAnswers((a) => ({ ...a, [id]: value }));

  const canProceed = (q: SurveyQuestion): boolean => {
    if (!q.required) return true;
    const v = answers[q.id];
    if (q.type === "multi") return Array.isArray(v) && v.length > 0;
    return typeof v === "string" && v.length > 0;
  };

  const next = () => {
    if (phase === "intro") setPhase(0);
    else if (typeof phase === "number") {
      if (phase + 1 < SURVEY_QUESTIONS.length) setPhase(phase + 1);
      else setPhase("contact");
    }
  };
  const back = () => {
    if (phase === "contact") setPhase(SURVEY_QUESTIONS.length - 1);
    else if (typeof phase === "number") {
      if (phase === 0) setPhase("intro");
      else setPhase(phase - 1);
    }
  };

  if (phase === "intro") {
    return (
      <div className="flex w-full max-w-xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="font-brand text-3xl sm:text-4xl">“开始”之前</h1>
          <p className="text-muted-foreground">感谢关注搬砖小鹅的每一位创作者</p>
        </div>
        <ul className="flex flex-col gap-3 text-sm leading-relaxed">
          <li className="flex gap-2.5">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            这份问卷大约需要 1 分钟，其中 3 题是选填。
          </li>
          <li className="flex gap-2.5">
            <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            这不是用户调研——我们在找有真实创作需求、愿意一起打磨产品的首批伙伴。
          </li>
          <li className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            通过筛选后，内测码会发到你的邮箱（或微信），用它即可直接进入产品。
          </li>
          <li className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            提交即表示同意我们处理这些信息；仅用于内测筛选，不作他用。
          </li>
        </ul>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {["约 1 分钟", `${totalSteps} 个问题`, "3 题选填", "仅用于内测筛选"].map((t) => (
            <span key={t} className="rounded-full border px-2.5 py-1">
              {t}
            </span>
          ))}
        </div>
        <div>
          <Button size="lg" onClick={next}>
            好，我们开始
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex w-full max-w-xl flex-col items-start gap-6">
        <span className="flex size-12 items-center justify-center rounded-full bg-poet/15">
          <Check className="size-6 text-poet" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-brand text-3xl">收到，申请已提交</h1>
          <p className="leading-relaxed text-muted-foreground">
            我们会分批审核并发放内测码，请留意 {email} 的收件箱
            {wechat ? "和微信好友申请" : ""}。拿到码后回到首页，点「我有内测码」即可开通。
          </p>
        </div>
        <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
          返回首页
        </Button>
      </div>
    );
  }

  const progress = Math.round((stepIndex / totalSteps) * 100);

  return (
    <div className="flex w-full max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span>
            {String(stepIndex).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {phase === "contact" ? (
        <ContactStep
          email={email}
          wechat={wechat}
          social={social}
          setEmail={setEmail}
          setWechat={setWechat}
          setSocial={setSocial}
        />
      ) : (
        <QuestionStep
          question={SURVEY_QUESTIONS[phase]!}
          value={answers[SURVEY_QUESTIONS[phase]!.id]}
          otherText={answers[`${SURVEY_QUESTIONS[phase]!.id}_other`]}
          setAnswer={setAnswer}
        />
      )}

      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -left-[9999px] top-0 h-px w-px opacity-0"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
      />

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={back}>
          <ArrowLeft data-icon="inline-start" />
          返回
        </Button>
        {phase === "contact" ? (
          <Button
            size="lg"
            disabled={!EMAIL_RE.test(email.trim()) || submit.isPending}
            onClick={() =>
              submit.mutate({
                email: email.trim().toLowerCase(),
                wechat: wechat.trim() || undefined,
                social: social.trim() || undefined,
                answers,
                surveyVersion: SURVEY_VERSION,
                website: website || undefined,
              })
            }
          >
            {submit.isPending ? "提交中…" : "提交申请"}
          </Button>
        ) : (
          <Button size="lg" disabled={!canProceed(SURVEY_QUESTIONS[phase]!)} onClick={next}>
            下一步
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
      {submit.error ? <p className="text-xs text-destructive">{submit.error.message}</p> : null}
    </div>
  );
}

function QuestionStep({
  question: q,
  value,
  otherText,
  setAnswer,
}: {
  question: SurveyQuestion;
  value: string | string[] | undefined;
  otherText: string | string[] | undefined;
  setAnswer: (id: string, value: string | string[]) => void;
}) {
  const selected = (opt: string) =>
    q.type === "multi" ? Array.isArray(value) && value.includes(opt) : value === opt;

  const toggle = (opt: string) => {
    if (q.type === "multi") {
      const cur = Array.isArray(value) ? value : [];
      setAnswer(q.id, cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt]);
    } else {
      setAnswer(q.id, value === opt ? "" : opt);
    }
  };

  const options = q.allowOther ? [...(q.options ?? []), OTHER] : (q.options ?? []);
  const showOther = q.allowOther && selected(OTHER);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold leading-snug">{q.title}</h2>
        <p className="text-xs text-muted-foreground">
          {q.hint ?? (q.type === "multi" ? "可多选" : "单选")}
          {q.required ? "" : " · 选填"}
        </p>
      </div>

      {q.type === "text" ? (
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="随便聊聊，或者跳过"
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((opt) => {
            const on = selected(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                aria-pressed={on}
                className={`flex items-center justify-between gap-3 rounded-lg border p-3.5 text-left text-sm transition-colors ${
                  on ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <span>{opt}</span>
                {on ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      )}

      {showOther ? (
        <Input
          value={typeof otherText === "string" ? otherText : ""}
          onChange={(e) => setAnswer(`${q.id}_other`, e.target.value)}
          placeholder="说说你的情况"
          maxLength={200}
          autoFocus
        />
      ) : null}
    </div>
  );
}

function ContactStep({
  email,
  wechat,
  social,
  setEmail,
  setWechat,
  setSocial,
}: {
  email: string;
  wechat: string;
  social: string;
  setEmail: (v: string) => void;
  setWechat: (v: string) => void;
  setSocial: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold leading-snug">最后，留下你的联系方式</h2>
        <p className="text-xs text-muted-foreground">邮箱必填，其他选填</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="apply-email">邮箱（必填）</Label>
        <Input
          id="apply-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">内测码会发到这里；之后请用这个邮箱登录。</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="apply-wechat">微信号（选填）</Label>
        <Input
          id="apply-wechat"
          value={wechat}
          onChange={(e) => setWechat(e.target.value)}
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">通过后拉你进种子用户群，沟通更快。</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="apply-social">主账号链接（选填）</Label>
        <Input
          id="apply-social"
          value={social}
          onChange={(e) => setSocial(e.target.value)}
          placeholder="小红书 / 抖音主页链接"
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">帮我们更快了解你的内容。</p>
      </div>
    </div>
  );
}
