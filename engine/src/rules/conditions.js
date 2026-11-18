// SRD 5.2.1 conditions as engine flags (Rules Glossary).
export const CONDITIONS = {
  blinded: { attackDis: true, attackedAdv: true, autoFailSight: true },
  charmed: {},
  deafened: {},
  frightened: { attackDis: true, checkDis: true },
  grappled: { speed0: true, attackDisNotGrappler: true },
  incapacitated: { noActions: true, breaksConc: true },
  invisible: { attackAdv: true, attackedDis: true },
  paralyzed: { noActions: true, breaksConc: true, speed0: true, autoFailStrDex: true, attackedAdv: true, critWithin5: true },
  petrified: { noActions: true, breaksConc: true, speed0: true, autoFailStrDex: true, attackedAdv: true, resistAll: true },
  poisoned: { attackDis: true, checkDis: true },
  prone: { attackDis: true, attackedAdvMelee: true, attackedDisRanged: true },
  restrained: { speed0: true, attackDis: true, attackedAdv: true, dexSaveDis: true },
  stunned: { noActions: true, breaksConc: true, speed0: true, autoFailStrDex: true, attackedAdv: true },
  unconscious: { noActions: true, breaksConc: true, speed0: true, autoFailStrDex: true, attackedAdv: true, critWithin5: true, prone: true },
};
export const flag = (conds, f) => conds.some(c => CONDITIONS[c.id || c]?.[f]);
