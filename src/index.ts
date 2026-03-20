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
const PLACEHOLDER_PATTERN =
  /your-?domain|my-?domain|my-?site|my-?company|your-?site|your-?company|some-?domain|some-?site|sample-?domain|placeholder|changeme|replace-?me/i;

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

export interface Options {
  readonly allowDomains?: readonly string[];
}

const rule: TextlintRuleModule<Options> = (context, options = {}) => {
  const { getSource, report, RuleError, Syntax } = context;
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
        report(
          node,
          new RuleError(
            `"${domain}" looks like a placeholder domain. Use RFC 2606 reserved domains instead (example.com, example.net, example.org) or reserved TLDs (.test, .example, .invalid, .localhost).`,
            { index: domainIndex },
          ),
        );
      }
    }
  };

  const checkNodeUrl = (node: Node) => {
    /* v8 ignore start -- Link/Image nodes always have a string url present in source */
    const url = "url" in node ? node.url : undefined;
    if (typeof url !== "string") return;
    const source = getSource(node);
    const urlStart = source.lastIndexOf(url);
    if (urlStart < 0) return;
    /* v8 ignore stop */
    checkText(url, node, urlStart);
  };

  return {
    [Syntax.Image](node) {
      checkNodeUrl(node);
    },
    [Syntax.Link](node) {
      checkNodeUrl(node);
    },
    [Syntax.Str](node) {
      checkText(getSource(node), node, 0);
    },
  };
};

export default rule;
