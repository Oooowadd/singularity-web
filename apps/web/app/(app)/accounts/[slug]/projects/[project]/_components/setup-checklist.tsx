"use client";

import Link from "next/link";
import { CircleCheckIcon, CircleIcon } from "lucide-react";

export type SetupStep = {
  label: string;
  href: string;
  done: boolean;
};

// Cross-component handshake: step ① opens the manage-competitors sheet directly
// instead of relying on hash scroll (the card body loads client-side via tRPC).
export const MANAGE_COMPETITORS_EVENT = "singularity:manage-competitors";

export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const firstPendingIndex = steps.findIndex((s) => !s.done);

  if (doneCount === steps.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm text-muted-foreground">
        <CircleCheckIcon className="size-4 text-poet" />
        <span>
          已全部完成 · {doneCount}/{steps.length}
        </span>
      </div>
    );
  }

  const handleHashStep = (href: string) => {
    const el = document.getElementById(href.slice(1));
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.dispatchEvent(new CustomEvent(MANAGE_COMPETITORS_EVENT));
  };

  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium">上手清单</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {doneCount}/{steps.length}
        </span>
      </header>
      <ol className="flex flex-col gap-1.5">
        {steps.map((step, i) => {
          const isCurrent = i === firstPendingIndex;
          const rowClass = `flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
            isCurrent
              ? "border-2 border-dashed border-poet/40 bg-poet/5"
              : "border border-transparent"
          }`;
          const inner = (
            <>
              {step.done ? (
                <CircleCheckIcon className="size-4 shrink-0 text-poet" />
              ) : (
                <CircleIcon className="size-4 shrink-0 text-muted-foreground/50" />
              )}
              <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
              <span className={step.done ? "text-muted-foreground line-through decoration-border" : ""}>
                {step.label}
              </span>
            </>
          );
          return (
            <li key={step.label}>
              {step.href.startsWith("#") ? (
                <button type="button" className={rowClass} onClick={() => handleHashStep(step.href)}>
                  {inner}
                </button>
              ) : (
                <Link href={step.href} className={rowClass}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
