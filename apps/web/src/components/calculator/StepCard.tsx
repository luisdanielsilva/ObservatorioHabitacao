"use client";

import { Check, Pencil } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StepStatus = "active" | "done" | "upcoming";

/**
 * One step of Avaliar anúncio. Done steps show a summary and an edit button; upcoming steps
 * only their title. When a step opens after the first render, it is scrolled into view and its
 * heading takes the focus, so keyboard and screen-reader users follow the flow.
 */
export function StepCard({
  number,
  title,
  status,
  summary,
  editLabel,
  onEdit,
  children,
}: {
  number: number;
  title: string;
  status: StepStatus;
  summary?: React.ReactNode;
  editLabel: string;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current && status === "active") {
      heading.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      heading.current?.focus({ preventScroll: true });
    }
    mounted.current = true;
  }, [status]);

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        "rounded-xl border bg-card p-5",
        status === "upcoming" && "bg-card/40 text-muted-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
              status === "active" && "border-primary bg-primary text-primary-foreground",
              status === "done" && "border-primary text-primary",
            )}
          >
            {status === "done" ? <Check className="size-4" /> : number}
          </span>
          <div className="min-w-0 space-y-1">
            <h2
              id={`${id}-title`}
              ref={heading}
              tabIndex={-1}
              className="scroll-mt-20 text-lg leading-7 font-semibold outline-none"
            >
              {title}
            </h2>
            {status === "done" && summary && (
              <div className="text-sm text-muted-foreground">{summary}</div>
            )}
          </div>
        </div>
        {status === "done" && onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} aria-describedby={`${id}-title`}>
            <Pencil />
            {editLabel}
          </Button>
        )}
      </div>
      {status === "active" && <div className="mt-5 space-y-5">{children}</div>}
    </section>
  );
}
