import type { RuleConfig } from "./types.js";

export class RuleError extends Error {}

/**
 * Returns the single enabled rule matching `url`, or undefined if none match.
 * Throws RuleError if more than one enabled rule matches (see plan.md, section 3).
 */
export function findMatchingRule(
  url: string,
  rules: RuleConfig[],
): RuleConfig | undefined {
  const matches = rules.filter(
    (rule) => (rule.enabled ?? true) && new RegExp(rule.match).test(url),
  );

  if (matches.length > 1) {
    throw new RuleError(
      `Multiple rules match URL "${url}": ${matches.map((r) => r.id).join(", ")}`,
    );
  }

  return matches[0];
}

/**
 * Builds the target URL for `rule` from `url`'s named capture groups, applying
 * each group's lookup table where defined and passing through otherwise.
 * Throws RuleError if a group has a lookup table but no entry for the matched value.
 */
export function buildTargetUrl(url: string, rule: RuleConfig): string {
  const match = new RegExp(rule.match).exec(url);
  if (!match?.groups) {
    throw new RuleError(
      `Rule "${rule.id}" does not match URL "${url}" or has no named groups`,
    );
  }
  const groups = match.groups;

  return rule.target.replace(/\$\{(\w+)\}/g, (_placeholder, name: string) => {
    if (!(name in groups)) {
      throw new RuleError(
        `Rule "${rule.id}": target references unknown group "${name}"`,
      );
    }
    const rawValue = groups[name];
    if (rawValue === undefined) {
      throw new RuleError(
        `Rule "${rule.id}": group "${name}" did not capture a value`,
      );
    }
    const lookup = rule.lookups?.[name];
    if (!lookup) return rawValue;

    const mappedValue = lookup[rawValue];
    if (mappedValue === undefined) {
      throw new RuleError(
        `Rule "${rule.id}": no lookup entry for group "${name}" value "${rawValue}"`,
      );
    }
    return mappedValue;
  });
}
