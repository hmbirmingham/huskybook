export const CATEGORIES = [
  { value: 'hair', label: 'Hair' },
  { value: 'nails', label: 'Nails' },
  { value: 'makeup', label: 'Makeup' },
  { value: 'braids', label: 'Braids' },
  { value: 'other', label: 'Other' },
];

export const TYPES = [
  { value: 'dorm', label: 'Dorm-based' },
  { value: 'mobile', label: 'Mobile (comes to you)' },
];

export function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

export function typeLabel(value) {
  return TYPES.find((t) => t.value === value)?.label || value;
}
