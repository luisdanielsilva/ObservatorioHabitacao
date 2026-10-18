"use client";

import { ChevronDown, ChevronUp, Lightbulb, LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { contactDefaults } from "./actions";
import { ContactForm, type ContactType } from "./ContactForm";

/** As long as the panel's slide (duration-300), so the form is reset only once it's out of sight. */
const SLIDE_MS = 320;

/**
 * "Precisas de ajuda ou tens uma ideia?" on the home page: each button opens the contact form
 * in place, on its own type; the other button switches the type, the same one (or Fechar) folds
 * it away again. What was typed is kept while folded; after a request is sent, the next opening
 * starts with an empty form.
 */
export function ContactBox() {
  const t = useTranslations("home");
  const tc = useTranslations("contact");
  const id = useId();
  const [open, setOpen] = useState<ContactType | null>(null);
  const [type, setType] = useState<ContactType>("support");
  const [defaults, setDefaults] = useState<{ name: string; email: string } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const sent = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const box = useRef<HTMLElement>(null);

  const close = useCallback(() => {
    setOpen(null);
    if (sent.current) {
      sent.current = false;
      setTimeout(() => setFormKey((k) => k + 1), SLIDE_MS);
    }
  }, []);
  const onSent = useCallback(() => {
    sent.current = true;
  }, []);

  function toggle(next: ContactType) {
    if (open === next) return close();
    const wasClosed = open === null;
    setOpen(next);
    if (!sent.current) setType(next);
    // A signed-in person's name and email, asked for once, the first time the form opens.
    if (!defaults) {
      contactDefaults().then(setDefaults, () => setDefaults({ name: "", email: "" }));
    }
    if (wasClosed) {
      setTimeout(() => {
        box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        heading.current?.focus({ preventScroll: true });
      }, 120);
    }
  }

  const buttons = [
    { value: "support", label: t("contactSupport"), Icon: LifeBuoy, variant: "default" },
    { value: "feature", label: t("contactFeature"), Icon: Lightbulb, variant: "outline" },
  ] as const;

  return (
    <section
      ref={box}
      aria-labelledby="contact"
      className={cn(
        "mb-14 rounded-2xl border bg-card transition-[border-color,box-shadow]",
        open && "border-primary/35 shadow-lg shadow-pine-deep/10",
      )}
    >
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="min-w-0">
          <h2 id="contact" className="text-xl font-semibold tracking-tight">
            {t("contactTitle")}
          </h2>
          <p className="mt-1 max-w-xl text-muted-foreground">{t("contactText")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {buttons.map(({ value, label, Icon, variant }) => (
            <Button
              key={value}
              type="button"
              variant={variant}
              aria-expanded={open === value}
              aria-controls={`${id}-panel`}
              onClick={() => toggle(value)}
              className={cn(
                open === value &&
                  "border-primary bg-mint-soft text-primary hover:bg-mint-soft dark:border-primary dark:bg-mint-soft",
              )}
            >
              <Icon aria-hidden />
              {label}
              <ChevronDown
                aria-hidden
                className={cn("-ml-0.5 transition-transform", open === value && "rotate-180")}
              />
            </Button>
          ))}
        </div>
      </div>

      {/* Grid rows 0fr → 1fr slide the panel to its own height. */}
      <div
        id={`${id}-panel`}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        {/* Hidden once folded, after the slide. */}
        <div
          className={cn(
            "min-h-0 overflow-hidden",
            !open && "invisible transition-[visibility] delay-300 motion-reduce:delay-0",
          )}
        >
          <div className="mx-6 space-y-5 border-t py-6 sm:mx-8 sm:pb-8">
            <div className="flex items-center justify-between gap-3">
              <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
                {tc(`types.${type}.label`)}
              </h3>
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                <ChevronUp aria-hidden />
                {tc("close")}
              </Button>
            </div>
            {defaults && (
              <ContactForm
                key={formKey}
                defaults={defaults}
                type={type}
                onSent={onSent}
                onClose={close}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
