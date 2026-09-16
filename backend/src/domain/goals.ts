/** Savings goals: progress, required pace, and whether the goal is on track. */

export type GoalStatus = 'atingido' | 'em_dia' | 'em_risco' | 'sem_prazo';

export type GoalProgress = {
  percent: number;
  remainingCents: number;
  monthsRemaining: number | null;
  requiredMonthlyCents: number | null;
  status: GoalStatus;
};

/** Whole calendar months from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm] = fromIso.slice(0, 7).split('-').map(Number);
  const [ty, tm] = toIso.slice(0, 7).split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/**
 * Average monthly contribution since the first deposit, counting the current
 * month. Returns null when there is nothing saved yet.
 */
export function monthlyPaceCents(
  savedCents: number,
  firstContributionIso: string | null,
  todayIso: string
): number | null {
  if (savedCents <= 0 || !firstContributionIso) return null;
  const monthsActive = Math.max(1, monthsBetween(firstContributionIso, todayIso) + 1);
  return Math.round(savedCents / monthsActive);
}

export function goalProgress(input: {
  targetCents: number;
  savedCents: number;
  deadline?: string | null;
  today: string;
  paceCents?: number | null;
}): GoalProgress {
  const target = Math.max(0, input.targetCents);
  const saved = Math.max(0, input.savedCents);
  const remainingCents = Math.max(0, target - saved);
  const percent = target === 0 ? 0 : Math.min(100, Math.round((saved / target) * 1000) / 10);

  if (remainingCents === 0) {
    return {
      percent,
      remainingCents: 0,
      monthsRemaining: input.deadline ? Math.max(0, monthsBetween(input.today, input.deadline)) : null,
      requiredMonthlyCents: 0,
      status: 'atingido',
    };
  }

  if (!input.deadline) {
    return {
      percent,
      remainingCents,
      monthsRemaining: null,
      requiredMonthlyCents: null,
      status: 'sem_prazo',
    };
  }

  const monthsRemaining = Math.max(0, monthsBetween(input.today, input.deadline));
  const requiredMonthlyCents =
    monthsRemaining === 0 ? remainingCents : Math.ceil(remainingCents / monthsRemaining);

  // Without a deadline reached and no observed pace we cannot claim risk yet.
  let status: GoalStatus = 'em_dia';
  if (monthsRemaining === 0) {
    status = 'em_risco';
  } else if (input.paceCents != null && input.paceCents < requiredMonthlyCents) {
    status = 'em_risco';
  }

  return { percent, remainingCents, monthsRemaining, requiredMonthlyCents, status };
}
