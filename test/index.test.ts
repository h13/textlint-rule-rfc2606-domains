import { TextlintKernel } from "@textlint/kernel";
import { parse as parseMarkdown } from "@textlint/markdown-to-ast";
import { parse } from "@textlint/text-to-ast";
import { describe, expect, it } from "vitest";

import rule from "../src/index.js";

type PreProcess = (text: string, filePath: string) => ReturnType<typeof parse>;

const postProcess = (
  messages: readonly { message: string }[],
  filePath: string,
) => ({ filePath, messages });

const createProcessor = (ext: string, preProcess: PreProcess) =>
  class {
    static availableExtensions() {
      return [ext];
    }
    processor() {
      return { postProcess, preProcess };
    }
  };

const TextProcessor = createProcessor(".txt", (text) => parse(text));
const MarkdownProcessor = createProcessor(".md", (text) => parseMarkdown(text));

const createLinter =
  (ext: string, Processor: ReturnType<typeof createProcessor>) =>
  async (
    text: string,
    options: Record<string, unknown> = {},
  ): Promise<readonly string[]> => {
    const kernel = new TextlintKernel();
    const result = await kernel.lintText(text, {
      ext,
      plugins: [{ plugin: { Processor }, pluginId: ext.slice(1) }],
      rules: [{ options, rule, ruleId: "rfc2606-domains" }],
    });
    return result.messages.map((m) => m.message);
  };

const createFixer =
  (ext: string, Processor: ReturnType<typeof createProcessor>) =>
  async (
    text: string,
    options: Record<string, unknown> = {},
  ): Promise<string> => {
    const kernel = new TextlintKernel();
    const result = await kernel.fixText(text, {
      ext,
      plugins: [{ plugin: { Processor }, pluginId: ext.slice(1) }],
      rules: [{ options, rule, ruleId: "rfc2606-domains" }],
    });
    return result.output;
  };

const lint = createLinter(".txt", TextProcessor);
const lintMd = createLinter(".md", MarkdownProcessor);
const fix = createFixer(".txt", TextProcessor);
const fixMd = createFixer(".md", MarkdownProcessor);

describe("rfc2606-domains", () => {
  describe("valid", () => {
    it("allows RFC 2606 reserved domains", async () => {
      expect(
        await lint("Send email to admin@example.com for support."),
      ).toEqual([]);
      expect(await lint("See https://example.org/docs for details.")).toEqual(
        [],
      );
      expect(await lint("Test at api.example.net endpoint.")).toEqual([]);
    });

    it("allows RFC 6761 reserved TLDs", async () => {
      expect(await lint("Use myapp.test for local development.")).toEqual([]);
      expect(await lint("Configure service.localhost for testing.")).toEqual(
        [],
      );
      expect(await lint("Route to backend.invalid for error testing.")).toEqual(
        [],
      );
      expect(await lint("Visit demo.example for documentation.")).toEqual([]);
    });

    it("allows real-world domains", async () => {
      expect(await lint("Visit https://github.com for source code.")).toEqual(
        [],
      );
    });

    it("allows domains in allowDomains option", async () => {
      expect(
        await lint("Configure your-domain.com in settings.", {
          allowDomains: ["your-domain.com"],
        }),
      ).toEqual([]);
    });

    it("flags domains matching additionalPatterns", async () => {
      const messages = await lint("Visit widgetcorp.com for details.", {
        additionalPatterns: ["widgetcorp"],
      });
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("widgetcorp.com");
    });

    it("does not flag non-matching additionalPatterns", async () => {
      expect(
        await lint("Visit github.com for source.", {
          additionalPatterns: ["widgetcorp"],
        }),
      ).toEqual([]);
    });

    it("fixes domains matching additionalPatterns", async () => {
      expect(
        await fix("Set widgetcorp.com in config.", {
          additionalPatterns: ["widgetcorp"],
        }),
      ).toBe("Set example.com in config.");
    });

    it("skips nodes listed in ignoreNodes", async () => {
      expect(
        await lintMd("Run `curl https://your-domain.com/api`.", {
          ignoreNodes: ["Code"],
        }),
      ).toEqual([]);
    });

    it("still flags non-ignored nodes with ignoreNodes", async () => {
      const messages = await lintMd(
        "Visit your-domain.com. Run `curl https://your-domain.com`.",
        { ignoreNodes: ["Code"] },
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("skips multiple node types in ignoreNodes", async () => {
      expect(
        await lintMd(
          "```\nhost: your-domain.com\n```\n\nRun `curl your-domain.com`.",
          { ignoreNodes: ["Code", "CodeBlock"] },
        ),
      ).toEqual([]);
    });

    it("skips Str nodes with ignoreNodes", async () => {
      expect(
        await lint("Visit your-domain.com for info.", {
          ignoreNodes: ["Str"],
        }),
      ).toEqual([]);
    });

    it("skips Html, Image, Link, Definition with ignoreNodes", async () => {
      expect(
        await lintMd(
          '<a href="https://your-domain.com">link</a>',
          { ignoreNodes: ["Html"] },
        ),
      ).toEqual([]);
      expect(
        await lintMd("![img](https://your-domain.com/img.png)", {
          ignoreNodes: ["Image"],
        }),
      ).toEqual([]);
      expect(
        await lintMd("[link](https://your-domain.com)", {
          ignoreNodes: ["Link", "Str"],
        }),
      ).toEqual([]);
      expect(
        await lintMd("[ref]: https://your-domain.com", {
          ignoreNodes: ["Definition"],
        }),
      ).toEqual([]);
    });

    it("fixes domains matching additionalPatterns with subdomains", async () => {
      expect(
        await fix("Call api.widgetcorp.com endpoint.", {
          additionalPatterns: ["widgetcorp"],
        }),
      ).toBe("Call api.example.com endpoint.");
    });

    it("does not flag non-domain text", async () => {
      expect(await lint("The variable yourDomain is a string.")).toEqual([]);
    });

    it("does not flag formerly-matched patterns like dummy.io or todo.com", async () => {
      expect(await lint("Use dummy.io as a test endpoint.")).toEqual([]);
      expect(await lint("Check todo.com for tasks.")).toEqual([]);
    });
  });

  describe("invalid", () => {
    it("flags your-domain.com with replacement suggestion", async () => {
      const messages = await lint(
        "Configure your-domain.com in the DNS settings.",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
      expect(messages[0]).toContain('"example.com"');
    });

    it("flags mydomain.org with TLD-appropriate suggestion", async () => {
      const messages = await lint(
        "Set the base URL to mydomain.org for production.",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("mydomain.org");
      expect(messages[0]).toContain('"example.org"');
    });

    it("flags mysite.com", async () => {
      const messages = await lint("Point your DNS to mysite.com please.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("mysite.com");
    });

    it("flags placeholder domains in email addresses", async () => {
      const messages = await lint("Email support@mycompany.net for help.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("mycompany.net");
    });

    it("flags placeholder.dev", async () => {
      const messages = await lint(
        "Replace placeholder.dev with your real domain.",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("placeholder.dev");
    });

    it("flags changeme.org", async () => {
      const messages = await lint("Update changeme.org in your config.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("changeme.org");
    });

    it("flags multiple placeholder domains in one line", async () => {
      const messages = await lint(
        "Set mydomain.com and your-site.org in the config.",
      );
      expect(messages).toHaveLength(2);
    });

    it("flags subdomains of placeholder domains", async () => {
      const messages = await lint("Call api.your-domain.com for the endpoint.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("api.your-domain.com");
    });

    it("flags mixed-case placeholder domains", async () => {
      const messages = await lint("Configure Your-Domain.COM in DNS.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("Your-Domain.COM");
    });

    it("flags placeholder domains in URLs with paths", async () => {
      const messages = await lint(
        "Visit https://your-domain.com/api/v1 for docs.",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("flags replaceme.com", async () => {
      const messages = await lint("Update replaceme.com with real domain.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("replaceme.com");
    });

    it("flags sample-domain.net", async () => {
      const messages = await lint("See sample-domain.net for examples.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("sample-domain.net");
    });

    it("flags somedomain.org", async () => {
      const messages = await lint("Configure somedomain.org in DNS.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("somedomain.org");
    });

    it("flags somesite.com", async () => {
      const messages = await lint("Visit somesite.com for docs.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("somesite.com");
    });

    it("flags yourcompany.net", async () => {
      const messages = await lint("Email admin@yourcompany.net for support.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("yourcompany.net");
    });
  });

  describe("domains in delimiters", () => {
    it("flags domains in parentheses", async () => {
      const messages = await lint("Check (your-domain.com) for details.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("flags domains in double quotes", async () => {
      const messages = await lint('Set "your-domain.com" in config.');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("flags domains in angle brackets", async () => {
      const messages = await lint("Use <your-domain.com> as the host.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });
  });

  describe("ccTLD support", () => {
    it("flags placeholder.co.uk", async () => {
      const messages = await lint("Visit placeholder.co.uk for info.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("placeholder.co.uk");
    });

    it("flags your-domain.co.jp", async () => {
      const messages = await lint("Set your-domain.co.jp as base URL.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.co.jp");
    });

    it("fixes placeholder.co.uk to example.com", async () => {
      expect(await fix("Visit placeholder.co.uk for info.")).toBe(
        "Visit example.com for info.",
      );
    });

    it("fixes your-domain.co.jp to example.com", async () => {
      expect(await fix("Set your-domain.co.jp as base URL.")).toBe(
        "Set example.com as base URL.",
      );
    });

    it("fixes api.your-domain.co.uk preserving non-placeholder subdomain", async () => {
      expect(await fix("Call api.your-domain.co.uk endpoint.")).toBe(
        "Call api.example.com endpoint.",
      );
    });
  });

  describe("markdown support", () => {
    it("flags placeholder domains in link URLs", async () => {
      const messages = await lintMd(
        "[click here](https://your-domain.com/page)",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("flags placeholder domains in image URLs", async () => {
      const messages = await lintMd(
        "![alt](https://your-domain.com/image.png)",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("flags domain in both link text and URL", async () => {
      const messages = await lintMd(
        "[your-domain.com](https://your-domain.com)",
      );
      expect(messages).toHaveLength(2);
    });

    it("fixes domain in URL when link text also contains it", async () => {
      expect(await fixMd("[your-domain.com](https://your-domain.com)")).toBe(
        "[example.com](https://example.com)",
      );
    });

    it("allows RFC 2606 domains in link URLs", async () => {
      expect(await lintMd("[docs](https://example.com/docs)")).toEqual([]);
    });

    it("allows RFC 2606 domains in image URLs", async () => {
      expect(await lintMd("![logo](https://example.org/logo.png)")).toEqual([]);
    });

    it("flags placeholder domains in reference-style link definitions", async () => {
      const messages = await lintMd("[mylink]: https://your-domain.com/docs");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("allows RFC 2606 domains in reference-style link definitions", async () => {
      expect(
        await lintMd("[mylink]: https://example.com/docs"),
      ).toEqual([]);
    });

    it("fixes placeholder domains in reference-style link definitions", async () => {
      expect(
        await fixMd("[mylink]: https://your-domain.com/docs"),
      ).toBe("[mylink]: https://example.com/docs");
    });
  });

  describe("HTML node support", () => {
    it("flags placeholder domains in inline HTML links", async () => {
      const messages = await lintMd(
        '<a href="https://your-domain.com">click</a>',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("flags placeholder domains in HTML img tags", async () => {
      const messages = await lintMd(
        '<img src="https://your-domain.com/logo.png" />',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("allows RFC 2606 domains in HTML", async () => {
      expect(
        await lintMd('<a href="https://example.com">docs</a>'),
      ).toEqual([]);
    });

    it("fixes placeholder domains in HTML", async () => {
      expect(
        await fixMd('<a href="https://your-domain.com">click</a>'),
      ).toBe('<a href="https://example.com">click</a>');
    });
  });

  describe("expanded placeholder patterns", () => {
    it("flags acme.com", async () => {
      const messages = await lint("Contact acme.com for enterprise plans.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("acme.com");
    });

    it("flags test-site.org", async () => {
      const messages = await lint("Deploy to test-site.org for staging.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("test-site.org");
    });

    it("flags testdomain.com", async () => {
      const messages = await lint("Set testdomain.com in your config.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("testdomain.com");
    });

    it("flags fake-domain.net", async () => {
      const messages = await lint("Use fake-domain.net for testing.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("fake-domain.net");
    });

    it("flags fakesite.com", async () => {
      const messages = await lint("Visit fakesite.com for demo.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("fakesite.com");
    });

    it("flags my-app.dev", async () => {
      const messages = await lint("Deploy my-app.dev to production.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("my-app.dev");
    });

    it("flags myserver.com", async () => {
      const messages = await lint("Connect to myserver.com via SSH.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("myserver.com");
    });

    it("flags your-api.io", async () => {
      const messages = await lint("Call your-api.io/v1/users endpoint.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-api.io");
    });

    it("flags yourserver.net", async () => {
      const messages = await lint("SSH into yourserver.net to deploy.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("yourserver.net");
    });

    it("flags xxxxx.com", async () => {
      const messages = await lint("Update xxxxx.com with your domain.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("xxxxx.com");
    });

    it("flags demo-site.com", async () => {
      const messages = await lint("Check demo-site.com for preview.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("demo-site.com");
    });

    it("flags demodomain.org", async () => {
      const messages = await lint("Visit demodomain.org for the demo.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("demodomain.org");
    });
  });

  describe("code node support", () => {
    it("flags placeholder domains in inline code", async () => {
      const messages = await lintMd("Run `curl https://your-domain.com/api`.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("flags placeholder domains in code blocks", async () => {
      const messages = await lintMd(
        "```yaml\nhost: your-domain.com\nport: 443\n```",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
    });

    it("allows RFC 2606 domains in inline code", async () => {
      expect(await lintMd("Use `curl https://example.com/api`.")).toEqual([]);
    });

    it("allows RFC 2606 domains in code blocks", async () => {
      expect(
        await lintMd("```yaml\nhost: example.com\nport: 443\n```"),
      ).toEqual([]);
    });
  });

  describe("fixer", () => {
    it("replaces placeholder domain with example.com", async () => {
      expect(await fix("Configure your-domain.com in DNS.")).toBe(
        "Configure example.com in DNS.",
      );
    });

    it("preserves .net TLD in replacement", async () => {
      expect(await fix("Set mysite.net as host.")).toBe(
        "Set example.net as host.",
      );
    });

    it("preserves .org TLD in replacement", async () => {
      expect(await fix("Visit mydomain.org for docs.")).toBe(
        "Visit example.org for docs.",
      );
    });

    it("uses example.com for uncommon TLDs", async () => {
      expect(await fix("Visit placeholder.dev for docs.")).toBe(
        "Visit example.com for docs.",
      );
    });

    it("preserves subdomains in replacement", async () => {
      expect(await fix("Call api.your-domain.com for data.")).toBe(
        "Call api.example.com for data.",
      );
    });

    it("replaces multiple placeholder domains", async () => {
      expect(await fix("Use mydomain.com and your-site.org here.")).toBe(
        "Use example.com and example.org here.",
      );
    });

    it("fixes placeholder domains in markdown links", async () => {
      expect(await fixMd("[docs](https://your-domain.com/page)")).toBe(
        "[docs](https://example.com/page)",
      );
    });

    it("fixes placeholder domains in markdown images", async () => {
      expect(await fixMd("![logo](https://your-domain.com/img.png)")).toBe(
        "![logo](https://example.com/img.png)",
      );
    });

    it("does not modify allowed domains", async () => {
      expect(
        await fix("Use your-domain.com here.", {
          allowDomains: ["your-domain.com"],
        }),
      ).toBe("Use your-domain.com here.");
    });

    it("fixes placeholder domains in inline code", async () => {
      expect(await fixMd("Run `curl https://your-domain.com/api`.")).toBe(
        "Run `curl https://example.com/api`.",
      );
    });

    it("fixes placeholder domains in code blocks", async () => {
      expect(await fixMd("```\nhost: your-domain.com\n```")).toBe(
        "```\nhost: example.com\n```",
      );
    });
  });

  describe("ReDoS protection", () => {
    it("skips text nodes exceeding MAX_TEXT_LENGTH", async () => {
      const longText = `${"a".repeat(10_001)} your-domain.com`;
      expect(await lint(longText)).toEqual([]);
    });
  });
});
