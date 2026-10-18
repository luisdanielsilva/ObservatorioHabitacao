"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The donation API shared by the SingleUseApps sites (license-service, routes/donation.js). It
 * accepts only these amounts and a plain ASCII label, and sends the person back to `returnTo`
 * with ?suaw_donation=thanks.
 */
const DONATION_API = "https://www.singleuseapps.com/api/checkout/donation";
const LABEL = "Observatorio Habitacao";
const AMOUNTS = [200, 500, 1000] as const;
/** Must be the publishable key of the Stripe account license-service uses (as in donate-widget.js). */
const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51U4kTtRpCbAHfa5oo6iUWnaqJpYsfaX6kOiHlXrw4RffpOuo5kiL5YvdKPVSUOR0viCXUnTb3kaSi5KlFeMe5zay00y9FPsJve";

type StripeCheckout = { mount(el: HTMLElement): void; destroy(): void };
declare global {
  interface Window {
    Stripe?: (key: string) => {
      initEmbeddedCheckout(options: { clientSecret: string }): Promise<StripeCheckout>;
    };
  }
}

let stripeJs: Promise<void> | null = null;
function loadStripeJs() {
  stripeJs ??= new Promise<void>((resolve, reject) => {
    if (window.Stripe) return resolve();
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.onload = () => resolve();
    s.onerror = () => {
      stripeJs = null;
      reject(new Error("stripe.js"));
    };
    document.head.appendChild(s);
  });
  return stripeJs;
}

/**
 * "Pagar um café" (issue #1): the Portuguese version of the SingleUseApps donation widget, on
 * the same API and Stripe account. 2, 5 or 10 €, no name or email asked; Stripe's embedded
 * checkout opens in place.
 */
export function DonateWidget() {
  const t = useTranslations("donate");
  const [amount, setAmount] = useState<number>(500);
  const [phase, setPhase] = useState<"choose" | "opening" | "checkout" | "thanks">("choose");
  const [error, setError] = useState(false);
  const checkoutEl = useRef<HTMLDivElement>(null);
  const checkout = useRef<StripeCheckout | null>(null);

  useEffect(() => {
    // Back from Stripe.
    if (new URLSearchParams(window.location.search).get("suaw_donation") === "thanks") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only known in the browser
      setPhase("thanks");
    }
    return () => checkout.current?.destroy();
  }, []);

  async function donate() {
    setError(false);
    setPhase("opening");
    try {
      const returnTo = new URL(window.location.href);
      returnTo.searchParams.delete("suaw_donation");
      returnTo.searchParams.delete("session_id");
      returnTo.hash = "";
      const response = await fetch(DONATION_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, label: LABEL, returnTo: returnTo.href }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { clientSecret } = (await response.json()) as { clientSecret: string };
      await loadStripeJs();
      setPhase("checkout");
      checkout.current = await window.Stripe!(STRIPE_PUBLISHABLE_KEY).initEmbeddedCheckout({
        clientSecret,
      });
      checkout.current.mount(checkoutEl.current!);
    } catch {
      // A donation that fails silently is worse than one that's refused: say so.
      checkout.current?.destroy();
      checkout.current = null;
      setPhase("choose");
      setError(true);
    }
  }

  if (phase === "thanks") {
    return (
      <p role="status" className="font-medium text-primary">
        {t("thanks")}
      </p>
    );
  }

  return (
    <div>
      {phase !== "checkout" && (
        <>
          <div role="group" aria-label={t("amount")} className="mb-3 grid grid-cols-3 gap-2">
            {AMOUNTS.map((cents) => (
              <button
                key={cents}
                type="button"
                aria-pressed={amount === cents}
                onClick={() => {
                  setAmount(cents);
                  setError(false);
                }}
                className={cn(
                  "rounded-xl border-[1.5px] bg-background/60 px-2 py-3 font-semibold transition hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  amount === cents && "border-primary bg-mint-soft",
                )}
              >
                {cents / 100} €
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="lg"
            className="h-12 w-full rounded-xl text-base"
            disabled={phase === "opening"}
            onClick={donate}
          >
            {phase === "opening" ? t("opening") : t("button", { amount: amount / 100 })}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t("error")}
        </p>
      )}
      <div ref={checkoutEl} className={phase === "checkout" ? "mt-1" : "hidden"} />
    </div>
  );
}
