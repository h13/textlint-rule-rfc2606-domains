# Changelog

## 0.1.0

Initial release.

### Features

- Detect placeholder domains (`your-domain`, `mydomain`, `mysite`,
  `mycompany`, `some-domain`, `sample-domain`, `placeholder`,
  `changeme`, `replace-me`, etc.) and suggest RFC 2606 reserved
  domains
- Support RFC 2606 reserved second-level domains (`example.com`,
  `example.net`, `example.org`)
- Support RFC 6761 reserved TLDs (`.test`, `.example`, `.invalid`,
  `.localhost`)
- Detect placeholder domains in emails (`user@mydomain.com`) and
  URLs (`https://your-domain.com/path`)
- `allowDomains` option to whitelist specific domains
