import { PageHeader } from "@/components/shared/PageHeader";

/** Layout for short text pages (coming soon, legal drafts). */
export function SimplePage({
  title,
  text,
  note,
  children,
}: {
  title: string;
  text: string;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader title={title} />
      {note && <p className="mb-4 text-sm text-warning">{note}</p>}
      <p className="leading-relaxed text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}
