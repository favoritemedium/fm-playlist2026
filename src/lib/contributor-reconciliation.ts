export interface ContributorCandidate {
  userId: string;
  name: string;
  email: string;
}

export const BLANK_LEGACY_NAME_KEY = "__blank_airtable_name__";
export const BLANK_LEGACY_NAME_LABEL = "(Blank Airtable name)";

export function normalizeLegacyName(value: string): string {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");

  return normalized === "" || normalized === BLANK_LEGACY_NAME_LABEL.toLocaleLowerCase("en-US")
    ? BLANK_LEGACY_NAME_KEY
    : normalized;
}

function normalizePersonText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const tokenScore = union === 0 ? 0 : intersection / union;

  if (left.includes(right) || right.includes(left)) {
    return Math.max(0.75, tokenScore);
  }

  return tokenScore;
}

export function suggestContributorCandidate(
  legacyName: string,
  candidates: ContributorCandidate[]
): ContributorCandidate | null {
  const normalizedLegacyName = normalizePersonText(legacyName);
  let best: { candidate: ContributorCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    const nameScore = similarity(normalizedLegacyName, normalizePersonText(candidate.name));
    const emailName = candidate.email.split("@")[0] || "";
    const emailScore = similarity(normalizedLegacyName, normalizePersonText(emailName));
    const score = Math.max(nameScore, emailScore);

    if (!best || score > best.score) best = { candidate, score };
  }

  return best && best.score >= 0.5 ? best.candidate : null;
}
