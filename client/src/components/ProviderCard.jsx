import Badge from './Badge.jsx';
import { categoryLabel, typeLabel } from '../lib/constants.js';

export default function ProviderCard({ provider, onRequest }) {
  return (
    <article className="shadow-pin relative flex flex-col gap-3 border-2 border-ink bg-[#fbf5e6] p-5">
      <span
        aria-hidden="true"
        className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-ink bg-rust"
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold leading-tight text-ink">
            {provider.name}
          </h3>
          <p className="text-sm text-ink-soft">{provider.buildingZone}</p>
        </div>
        {provider.available ? (
          <Badge tone="pine">Available</Badge>
        ) : (
          <Badge tone="outline">Not taking cuts</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone="navy">{categoryLabel(provider.category)}</Badge>
        <Badge tone="outline">{typeLabel(provider.type)}</Badge>
        {provider.verified && <Badge tone="amber">Verified</Badge>}
      </div>

      {provider.specialties.length > 0 && (
        <p className="text-sm text-ink-soft">{provider.specialties.join(' · ')}</p>
      )}

      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="font-display text-lg font-semibold text-navy">
          {provider.priceRange || 'Price varies'}
        </span>
        <button
          type="button"
          onClick={() => onRequest(provider)}
          disabled={!provider.available}
          className="border-2 border-ink bg-ink px-4 py-2 text-sm font-semibold text-paper transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-ink/30 disabled:bg-transparent disabled:text-ink/40 disabled:hover:translate-y-0"
        >
          Request a service
        </button>
      </div>
    </article>
  );
}
