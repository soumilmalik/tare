/** Shared padding and title for a tab screen. */
export function Screen({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-5 pt-6 pb-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}
