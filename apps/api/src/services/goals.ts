import { Decimal } from "@prisma/client/runtime/library";

interface LinkedAccountBalance {
  account: {
    balances: { amount: Decimal }[];
  };
}

interface GoalWithAccounts {
  targetAmount: Decimal;
  initialAmount: Decimal;
  deadline: Date;
  interval: string; // "weekly" | "monthly"
  accounts: LinkedAccountBalance[];
}

export interface GoalProgress {
  currentAmount: number;
  remaining: number;
  percentComplete: number;
  requiredPerInterval: number | null;
  isCompleted: boolean;
  isOverdue: boolean;
}

export function calculateGoalProgress(goal: GoalWithAccounts): GoalProgress {
  const target = Number(goal.targetAmount);
  const initial = Number(goal.initialAmount);

  const linkedBalance = goal.accounts.reduce((sum, ga) => {
    const latest = ga.account.balances[0];
    return sum + (latest ? Number(latest.amount) : 0);
  }, 0);

  const currentAmount = initial + linkedBalance;
  const remaining = Math.max(0, target - currentAmount);
  const isCompleted = currentAmount >= target;
  const percentComplete = target > 0 ? Math.min(100, (currentAmount / target) * 100) : 0;

  const now = new Date();
  const isOverdue = goal.deadline < now;

  let requiredPerInterval: number | null = null;

  if (!isCompleted && !isOverdue) {
    const intervalsLeft = countIntervalsRemaining(now, goal.deadline, goal.interval);
    requiredPerInterval = intervalsLeft > 0 ? remaining / intervalsLeft : null;
  }

  return {
    currentAmount,
    remaining,
    percentComplete,
    requiredPerInterval,
    isCompleted,
    isOverdue,
  };
}

function countIntervalsRemaining(from: Date, to: Date, interval: string): number {
  if (interval === "monthly") {
    const months =
      (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth());
    return Math.max(0, months);
  }

  // weekly
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / msPerWeek));
}
