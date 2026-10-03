export function PageHeader({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {intro && <p className="max-w-3xl text-muted-foreground text-pretty">{intro}</p>}
      {children}
    </div>
  );
}
