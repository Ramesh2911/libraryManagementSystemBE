// Coordinator module permissions — owner toggles these per coordinator.
// Coordinator can only act on modules set to true (enforced by requireModule middleware).
export const MODULES = [
  'students',
  'admissions',
  'payments',
  'deposits',
  'seats',
  'lockers',
  'visitors',
  'attendance',
  'setup',
  'analytics',
] as const;

export type ModuleName = (typeof MODULES)[number];

export const isModuleName = (v: string): v is ModuleName =>
  (MODULES as readonly string[]).includes(v);
