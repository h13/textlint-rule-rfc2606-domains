import type {
  TextlintFixableRuleModule,
  TextlintRuleReporter,
} from "@textlint/types";

// RFC 2606 reserved second-level domains
const RESERVED_DOMAINS = new Set(["example.com", "example.net", "example.org"]);

// RFC 2606 / RFC 6761 reserved TLDs
const RESERVED_TLDS = new Set([".example", ".invalid", ".localhost", ".test"]);

// Map TLD to RFC 2606 reserved domain for fixer
const RFC_DOMAIN_MAP: Readonly<Record<string, string>> = {
  com: "example.com",
  net: "example.net",
  org: "example.org",
};

// Common placeholder domain patterns that should use RFC 2606 domains instead
const PLACEHOLDER_PATTERN =
  /your-?domain|my-?domain|my-?site|my-?company|your-?site|your-?company|your-?app|your-?api|your-?server|my-?app|my-?api|my-?server|some-?domain|some-?site|sample-?domain|test-?site|test-?domain|fake-?domain|fake-?site|demo-?site|demo-?domain|placeholder|changeme|replace-?me|acme|x{3,}/i;

// Match domain-like strings preceded by any non-alphanumeric character or start of string
// Captures: optional subdomains + domain + TLD (2+ alpha chars)
const DOMAIN_REGEX =
  /(?:[^a-zA-Z0-9]|^)(([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\.([a-zA-Z]{2,}))(?=[^a-zA-Z0-9]|$)/g;

// Skip regex matching on very long text nodes to avoid ReDoS
const MAX_TEXT_LENGTH = 10_000;

const isReservedDomain = (lower: string): boolean =>
  RESERVED_DOMAINS.has(lower) ||
  RESERVED_TLDS.has(`.${lower.substring(lower.lastIndexOf(".") + 1)}`);

const isPlaceholderDomain = (domain: string): boolean =>
  domain
    .split(".")
    .slice(0, -1)
    .some((part) => PLACEHOLDER_PATTERN.test(part));

const buildReplacement = (domain: string, sld: string, tld: string): string => {
  const baseDomain = `${sld}.${tld}`;
  const subdomainPrefix = domain.slice(0, domain.length - baseDomain.length);
  const rfcDomain = RFC_DOMAIN_MAP[tld.toLowerCase()] ?? "example.com";
  if (!subdomainPrefix) return rfcDomain;
  const cleanLabels = subdomainPrefix
    .replace(/\.$/, "")
    .split(".")
    .filter((label) => !PLACEHOLDER_PATTERN.test(label));
  return cleanLabels.length > 0
    ? `${cleanLabels.join(".")}.${rfcDomain}`
    : rfcDomain;
};

export interface Options {
  readonly allowDomains?: readonly string[];
}

const reporter: TextlintRuleReporter<Options> = (context, options = {}) => {
  const { fixer, getSource, report, RuleError, Syntax } = context;
  type Node = Parameters<typeof report>[0];
  const allowDomains = new Set(
    (options.allowDomains ?? []).map((d) => d.toLowerCase()),
  );

  const checkText = (text: string, node: Node, baseIndex: number) => {
    if (text.length > MAX_TEXT_LENGTH) return;
    DOMAIN_REGEX.lastIndex = 0;
    let match;

    while ((match = DOMAIN_REGEX.exec(text)) !== null) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DOMAIN_REGEX group 1 always captures
      const domain = match[1]!;
      const lower = domain.toLowerCase();

      if (isReservedDomain(lower) || allowDomains.has(lower)) {
        continue;
      }

      if (isPlaceholderDomain(lower)) {
        const domainIndex = baseIndex + match.index + match[0].indexOf(domain);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DOMAIN_REGEX groups 3,4 always capture
        const replacement = buildReplacement(domain, match[3]!, match[4]!);
        report(
          node,
          new RuleError(
            `"${domain}" looks like a placeholder domain. Use "${replacement}" instead (RFC 2606).`,
            {
              fix: fixer.replaceTextRange(
                [domainIndex, domainIndex + domain.length],
                replacement,
              ),
              index: domainIndex,
            },
          ),
        );
      }
    }
  };

  const checkNodeProperty = (node: Node, prop: string) => {
    /* v8 ignore start -- target nodes always have the expected string property in source */
    const value =
      prop in node
        ? (node as unknown as Record<string, unknown>)[prop]
        : undefined;
    if (typeof value !== "string") return;
    const source = getSource(node);
    const valueStart = source.lastIndexOf(value);
    if (valueStart < 0) return;
    /* v8 ignore stop */
    checkText(value, node, valueStart);
  };

  return {
    [Syntax.Code](node) {
      checkNodeProperty(node, "value");
    },
    [Syntax.CodeBlock](node) {
      checkNodeProperty(node, "value");
    },
    [Syntax.Definition](node) {
      checkNodeProperty(node, "url");
    },
    [Syntax.Html](node) {
      checkText(getSource(node), node, 0);
    },
    [Syntax.Image](node) {
      checkNodeProperty(node, "url");
    },
    [Syntax.Link](node) {
      checkNodeProperty(node, "url");
    },
    [Syntax.Str](node) {
      checkText(getSource(node), node, 0);
    },
  };
};

const rule: TextlintFixableRuleModule<Options> = {
  fixer: reporter,
  linter: reporter,
};

export default rule;
