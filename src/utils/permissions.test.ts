import { canEditOrderByRole } from './permissions';

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): { toBe(expected: any): void };

describe('canEditOrderByRole', () => {
  it('permite admin, estabelecimento e atendente', () => {
    expect(canEditOrderByRole('admin')).toBe(true);
    expect(canEditOrderByRole('estabelecimento')).toBe(true);
    expect(canEditOrderByRole('atendente')).toBe(true);
  });

  it('nega outros perfis e valores falsy', () => {
    expect(canEditOrderByRole('cliente')).toBe(false);
    expect(canEditOrderByRole(undefined)).toBe(false);
    expect(canEditOrderByRole(null as any)).toBe(false);
    expect(canEditOrderByRole('')).toBe(false);
  });
});

