import type { TextlintRuleModule } from "@textlint/types";

// RFC 2606 reserved second-level domains
const RESERVED_DOMAINS = new Set([
  "example.com",
  "example.net",
  "example.org",
]);

// RFC 2606 / RFC 6761 reserved TLDs
const RESERVED_TLDS = new Set([".example", ".invalid", ".localhost", ".test"]);

// Common placeholder domain patterns that should use RFC 2606 domains instead
const PLACEHOLDER_PATTERNS = [
  /your-?domain/i,
  /my-?domain/i,
  /my-?site/i,
  /my-?company/i,
  /your-?site/i,
  /your-?company/i,
  /some-?domain/i,
  /some-?site/i,
  /sample-?domain/i,
  /placeholder/i,
  /changeme/i,
  /replace-?me/i,
];

// Match domain-like strings, including after @ (email) and in URLs
// Captures: optional subdomains + domain + TLD (2+ alpha chars)
const DOMAIN_REGEX =
  /(?:[@/.]|^|\s)(([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\.([a-zA-Z]{2,}))(?=[^a-zA-Z0-9]|$)/g;

// Skip regex matching on very long text nodes to avoid ReDoS
const MAX_TEXT_LENGTH = 10_000;

const isReservedDomain = (domain: string): boolean => {
  const lower = domain.toLowerCase();
  if (RESERVED_DOMAINS.has(lower)) {
    return true;
  }
  const tld = lower.substring(lower.lastIndexOf(".") + 1);
  return RESERVED_TLDS.has(`.${tld}`);
};

const isPlaceholderDomain = (domain: string): boolean => {
  // Check all parts of the domain (not just the first subdomain)
  const parts = domain.split(".");
  // Domain always contains at least one "." (guaranteed by DOMAIN_REGEX),
  // so parts.length >= 2 and the indexed access is safe.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const domainName = parts[parts.length - 2]!;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(domainName));
};

export interface Options {
  readonly allowDomains?: readonly string[];
}

const rule: TextlintRuleModule<Options> = (context, options = {}) => {
  const { getSource, report, RuleError, Syntax } = context;
  const allowDomains = new Set(
    (options.allowDomains ?? []).map((d) => d.toLowerCase()),
  );

  return {
    [Syntax.Str](node) {
      const text = getSource(node);
      if (text.length > MAX_TEXT_LENGTH) return;
      let match;
      DOMAIN_REGEX.lastIndex = 0;

      while ((match = DOMAIN_REGEX.exec(text)) !== null) {
        // DOMAIN_REGEX group 1 always captures when match is non-null
        const domain = match[1] as string;
        const lower = domain.toLowerCase();

        if (isReservedDomain(lower) || allowDomains.has(lower)) {
          continue;
        }

        if (isPlaceholderDomain(lower)) {
          const domainIndex = match.index + match[0].indexOf(domain);
          report(
            node,
            new RuleError(
              `"${domain}" looks like a placeholder domain. Use RFC 2606 reserved domains instead (example.com, example.net, example.org) or reserved TLDs (.test, .example, .invalid, .localhost).`,
              { index: domainIndex },
            ),
          );
        }
      }
    },
  };
};

export default rule;
