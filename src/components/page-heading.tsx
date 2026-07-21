export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-balance text-3xl font-bold leading-tight tracking-[-0.035em] sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-[var(--muted)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
