/**
 * The profile asked for after the first sign-in (issue #7): name required, phone and date of
 * birth optional. Accounts are for people aged 16 or more (owner, 2026-10-17).
 */
export const MIN_AGE = 16;

export type ProfileInput = { name: string; phone: string | null; birthDate: string | null };
export type ProfileError = "name" | "phone" | "birthDate" | "tooYoung";

/** Checks and tidies the form's fields: the profile to save, or the fields that are wrong. */
export function parseProfile(
  form: { name?: unknown; phone?: unknown; birthDate?: unknown },
  today: Date = new Date(),
): { ok: true; profile: ProfileInput } | { ok: false; errors: ProfileError[] } {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const errors: ProfileError[] = [];

  const name = text(form.name).replace(/\s+/g, " ").slice(0, 120);
  if (name.length < 2) errors.push("name");

  // Digits with an optional leading +, spaces, dots, dashes or brackets between them.
  const phoneRaw = text(form.phone).replace(/\s+/g, " ");
  let phone: string | null = null;
  if (phoneRaw) {
    const digits = phoneRaw.replace(/\D/g, "");
    if (!/^\+?[\d\s().-]+$/.test(phoneRaw) || digits.length < 9 || digits.length > 15) {
      errors.push("phone");
    } else phone = phoneRaw.slice(0, 30);
  }

  const birthRaw = text(form.birthDate);
  let birthDate: string | null = null;
  if (birthRaw) {
    const age = ageOn(birthRaw, today);
    if (age === null || age > 120) errors.push("birthDate");
    else if (age < MIN_AGE) errors.push("tooYoung");
    else birthDate = birthRaw;
  }

  return errors.length ? { ok: false, errors } : { ok: true, profile: { name, phone, birthDate } };
}

/** Age in full years on `today` for a YYYY-MM-DD date, or null if it isn't a real past date. */
export function ageOn(date: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const born = new Date(Date.UTC(y, mo - 1, d));
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== mo - 1 || born.getUTCDate() !== d) {
    return null;
  }
  const [ty, tm, td] = [today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()];
  const age = ty - y - (tm < mo || (tm === mo && td < d) ? 1 : 0);
  return age < 0 ? null : age;
}
