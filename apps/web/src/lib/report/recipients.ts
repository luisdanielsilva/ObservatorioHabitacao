import { z } from "zod";

/**
 * Who a report email goes to (issue #12): always the account's own address, and at most one
 * more, optional. Undefined when the extra address is not a valid email.
 */
export function reportRecipients(account: string, extra: string): string[] | undefined {
  const other = extra.trim();
  if (!other) return [account];
  const parsed = z.email().max(200).safeParse(other);
  if (!parsed.success) return undefined;
  return parsed.data.toLowerCase() === account.toLowerCase() ? [account] : [account, parsed.data];
}
