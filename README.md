# textlint-rule-rfc2606-domains

[![npm](https://img.shields.io/npm/v/textlint-rule-rfc2606-domains)](https://www.npmjs.com/package/textlint-rule-rfc2606-domains)
[![CI](https://github.com/h13/textlint-rule-rfc2606-domains/actions/workflows/ci.yml/badge.svg)](https://github.com/h13/textlint-rule-rfc2606-domains/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/h13/textlint-rule-rfc2606-domains/graph/badge.svg)](https://codecov.io/gh/h13/textlint-rule-rfc2606-domains)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A [textlint](https://textlint.github.io/) rule that detects
placeholder domains in documentation and suggests
[RFC 2606](https://www.rfc-editor.org/rfc/rfc2606.html) reserved
domains instead.

## Why?

Documentation often contains fake domains like `your-domain.com`
or `mysite.com`. These domains may actually be registered by
someone, leading to confusion or security issues. RFC 2606
reserves specific domains for safe use in documentation:

- **Second-level domains**: `example.com`, `example.net`,
  `example.org`
- **Reserved TLDs**: `.test`, `.example`, `.invalid`, `.localhost`

## Install

```bash
npm install -D textlint-rule-rfc2606-domains
```

```bash
yarn add -D textlint-rule-rfc2606-domains
```

```bash
pnpm add -D textlint-rule-rfc2606-domains
```

## Usage

Add to your `.textlintrc.json`:

```json
{
  "rules": {
    "rfc2606-domains": true
  }
}
```

### Options

#### `allowDomains`

Domains to allow (e.g., your actual production domain):

```json
{
  "rules": {
    "rfc2606-domains": {
      "allowDomains": ["my-real-product.com"]
    }
  }
}
```

#### `additionalPatterns`

Additional placeholder patterns to detect (matched against
each domain label):

```json
{
  "rules": {
    "rfc2606-domains": {
      "additionalPatterns": ["widgetcorp", "testcorp"]
    }
  }
}
```

## Auto-fix

This rule supports `textlint --fix`. Placeholder domains are
automatically replaced with the corresponding RFC 2606 domain:

- `.com` → `example.com`, `.net` → `example.net`,
  `.org` → `example.org`, others → `example.com`
- Subdomains are preserved:
  `api.your-domain.com` → `api.example.com`

## What Gets Flagged

Domains with placeholder-like names in text, links, images,
inline code, code blocks, HTML, and reference-style link definitions:

| Pattern         | Example           | Suggestion    |
| --------------- | ----------------- | ------------- |
| `your-domain.*` | `your-domain.com` | `example.com` |
| `mydomain.*`    | `mydomain.org`    | `example.org` |
| `mysite.*`      | `mysite.com`      | `example.com` |
| `mycompany.*`   | `mycompany.net`   | `example.net` |
| `acme.*`        | `acme.com`        | `example.com` |
| `placeholder.*` | `placeholder.dev` | `example.com` |
| `changeme.*`    | `changeme.org`    | `example.org` |
| `replace-me.*`  | `replace-me.com`  | `example.com` |
| `test-site.*`   | `test-site.org`   | `example.org` |
| `fake-domain.*` | `fake-domain.net` | `example.net` |
| `demo-site.*`   | `demo-site.com`   | `example.com` |
| `my-app.*`      | `my-app.dev`      | `example.com` |
| `your-api.*`    | `your-api.io`     | `example.com` |

Also detected: `my-api`, `my-server`, `your-server`, `test-domain`,
`fake-site`, `demo-domain`, `sample-domain`, `some-domain`, `some-site`,
and `xxx` patterns (3+ consecutive x's).

RFC 2606 reserved domains and well-known real domains
(e.g., `github.com`) are never flagged.

## License

[MIT](LICENSE)
