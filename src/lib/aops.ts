// AoPS wiki links. We store links + metadata only — never problem text.
const BASE = "https://artofproblemsolving.com/wiki/index.php/";

function slug(contest: string, year: number) {
  return `${year}_${contest.trim().replace(/\s+/g, "_")}_Problems`;
}

/** Problem on the full-test page (anchor), which shows the statement without solutions. */
export function aopsProblemUrl(contest: string, year: number, n: number) {
  return `${BASE}${slug(contest, year)}#Problem_${n}`;
}

/** Individual problem page, which includes solutions. Show only after an attempt. */
export function aopsSolutionUrl(contest: string, year: number, n: number) {
  return `${BASE}${slug(contest, year)}/Problem_${n}`;
}

export function isAopsUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "artofproblemsolving.com";
  } catch {
    return false;
  }
}
