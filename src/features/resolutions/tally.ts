export type ResolutionResults = {
  totalVotes: number;
  eligibleVoters: number;
  /** Frozen at closing; live while voting is open. */
  eligibleIsFinal: boolean;
  options: { id: string; votes: number; percentage: number }[];
};

/**
 * Pure tally: per-option counts → shares with one decimal, in display order.
 * `eligible` is never allowed below the number of ballots (a member disabled after
 * voting still counted), so turnout cannot exceed 100 %.
 */
export function tallyVotes(params: {
  optionIds: readonly string[];
  counts: ReadonlyMap<string, number>;
  eligible: number;
  eligibleIsFinal: boolean;
}): ResolutionResults {
  const { optionIds, counts, eligible, eligibleIsFinal } = params;
  const totalVotes = optionIds.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);

  return {
    totalVotes,
    eligibleVoters: Math.max(eligible, totalVotes),
    eligibleIsFinal,
    options: optionIds.map((id) => {
      const votes = counts.get(id) ?? 0;
      return { id, votes, percentage: totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 1000) / 10 };
    }),
  };
}
