# Changelog

## 0.3.0

### Features

- Add Codecov integration with coverage badge

### Maintenance

- Update all dependencies to latest major versions (eslint 10, vitest 4, @textlint/\* 15, eslint-plugin-perfectionist 5)

## 0.2.0

### Breaking Changes

- Remove `dummy` and `todo` patterns to avoid false positives on real services (e.g., `todo.com`, `dummy.io`)

### Improvements

- Add edge case tests (multiple domains, subdomains, mixed case, URLs with paths)
- Use shared publish workflow

## 0.1.0

Initial release.

### Features

- Detect placeholder domains (`your-domain`, `mydomain`, `mysite`, `mycompany`, `some-domain`, `sample-domain`, `placeholder`, `changeme`, `replace-me`, etc.) and suggest RFC 2606 reserved domains
- Support RFC 2606 reserved second-level domains (`example.com`, `example.net`, `example.org`)
- Support RFC 6761 reserved TLDs (`.test`, `.example`, `.invalid`, `.localhost`)
- Detect placeholder domains in emails (`user@mydomain.com`) and URLs (`https://your-domain.com/path`)
- `allowDomains` option to whitelist specific domains
