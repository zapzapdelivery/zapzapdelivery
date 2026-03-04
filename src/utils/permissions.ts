export const canEditOrderByRole = (role?: string | null): boolean => {
  if (!role) return false;
  return role === 'admin' || role === 'estabelecimento' || role === 'atendente';
};

export const __devTestPermissions = () => {
  const cases: Array<[any, boolean]> = [
    [undefined, false],
    [null, false],
    ['admin', true],
    ['estabelecimento', true],
    ['atendente', true],
    ['cliente', false],
  ];
  return cases.every(([r, expected]) => canEditOrderByRole(r) === expected);
};
