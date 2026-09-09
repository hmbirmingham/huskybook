const TONES = {
  pine: 'border-pine bg-pine text-paper',
  amber: 'border-amber bg-amber text-paper',
  outline: 'border-ink/30 bg-transparent text-ink-soft',
  navy: 'border-navy bg-navy text-paper',
};

export default function Badge({ tone = 'outline', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
