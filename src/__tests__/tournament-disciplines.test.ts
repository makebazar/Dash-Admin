import { describe, it, expect } from 'vitest';

interface DisciplineValidation {
  key: string;
  name: string;
  is_system: boolean;
}

function canDeleteDiscipline(d: DisciplineValidation): boolean {
  if (d.is_system || d.key === 'cs2' || d.key === 'dota2') {
    return false;
  }
  return true;
}

function sanitizeDisciplineKey(rawKey: string): string {
  return rawKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function isReservedSystemKey(key: string): boolean {
  return key === 'cs2' || key === 'dota2';
}

describe('Tournament Disciplines Validation Rules', () => {
  it('should block deletion of system disciplines (CS2 and Dota 2)', () => {
    expect(canDeleteDiscipline({ key: 'cs2', name: 'Counter-Strike 2', is_system: true })).toBe(false);
    expect(canDeleteDiscipline({ key: 'dota2', name: 'Dota 2', is_system: true })).toBe(false);
    expect(canDeleteDiscipline({ key: 'cs2', name: 'CS2 Custom Name', is_system: false })).toBe(false);
    expect(canDeleteDiscipline({ key: 'dota2', name: 'Dota 2 Custom Name', is_system: false })).toBe(false);
  });

  it('should allow deletion of custom disciplines', () => {
    expect(canDeleteDiscipline({ key: 'fifa', name: 'EA FC / FIFA', is_system: false })).toBe(true);
    expect(canDeleteDiscipline({ key: 'ufc', name: 'UFC', is_system: false })).toBe(true);
    expect(canDeleteDiscipline({ key: 'valorant', name: 'Valorant', is_system: false })).toBe(true);
  });

  it('should identify reserved system keys', () => {
    expect(isReservedSystemKey('cs2')).toBe(true);
    expect(isReservedSystemKey('dota2')).toBe(true);
    expect(isReservedSystemKey('valorant')).toBe(false);
    expect(isReservedSystemKey('fifa')).toBe(false);
  });

  it('should sanitize discipline keys properly', () => {
    expect(sanitizeDisciplineKey('  VALORANT  ')).toBe('valorant');
    expect(sanitizeDisciplineKey('Mortal Kombat 1!')).toBe('mortalkombat1');
    expect(sanitizeDisciplineKey('apex-legends_2')).toBe('apex-legends_2');
  });
});
