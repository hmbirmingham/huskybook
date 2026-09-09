// Central place for what a provider row is allowed to reveal, and to whom.
// The privacy rule that matters for this app — never expose exact_location
// or contact_method except to a requester whose specific request has been
// accepted — is enforced here and only here, so no route can leak it by
// forgetting to strip a field.
export function toPublicProvider(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    type: row.type,
    buildingZone: row.building_zone,
    specialties: JSON.parse(row.specialties),
    priceRange: row.price_range,
    available: Boolean(row.available),
    verified: Boolean(row.verified),
  };
}

export function toOwnerProvider(row) {
  return {
    ...toPublicProvider(row),
    exactLocation: row.exact_location,
    contactMethod: row.contact_method,
  };
}
