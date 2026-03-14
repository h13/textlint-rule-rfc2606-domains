import { TextlintKernel } from "@textlint/kernel";
import { parse as parseMarkdown } from "@textlint/markdown-to-ast";
import { parse } from "@textlint/text-to-ast";
import { describe, expect, it } from "vitest";

import rule from "../src/index.js";

class MarkdownProcessor {
  static availableExtensions() {
    return [".md"];
  }
  processor() {
    return {
      postProcess(
        messages: readonly { message: string }[],
        filePath: string,
      ) {
        return { filePath, messages };
      },
      preProcess(text: string, _filePath: string) {
        return parseMarkdown(text);
      },
    };
  }
}

class TextProcessor {
  static availableExtensions() {
    return [".txt"];
  }
  processor() {
    return {
      postProcess(
        messages: readonly { message: string }[],
        filePath: string,
      ) {
        return { filePath, messages };
      },
      preProcess(text: string, _filePath: string) {
        return parse(text);
      },
    };
  }
}

const lint = async (
  text: string,
  options: Record<string, unknown> = {},
): Promise<readonly string[]> => {
  const kernel = new TextlintKernel();
  const result = await kernel.lintText(text, {
    ext: ".txt",
    plugins: [
      {
        plugin: { Processor: TextProcessor },
        pluginId: "text",
      },
    ],
    rules: [{ options, rule, ruleId: "rfc2606-domains" }],
  });
  return result.messages.map((m) => m.message);
};

const lintMd = async (
  text: string,
  options: Record<string, unknown> = {},
): Promise<readonly string[]> => {
  const kernel = new TextlintKernel();
  const result = await kernel.lintText(text, {
    ext: ".md",
    plugins: [
      {
        plugin: { Processor: MarkdownProcessor },
        pluginId: "markdown",
      },
    ],
    rules: [{ options, rule, ruleId: "rfc2606-domains" }],
  });
  return result.messages.map((m) => m.message);
};

describe("rfc2606-domains", () => {
  describe("valid", () => {
    it("allows RFC 2606 reserved domains", async () => {
      expect(await lint("Send email to admin@example.com for support.")).toEqual(
        [],
      );
      expect(await lint("See https://example.org/docs for details.")).toEqual(
        [],
      );
      expect(await lint("Test at api.example.net endpoint.")).toEqual([]);
    });

    it("allows RFC 6761 reserved TLDs", async () => {
      expect(await lint("Use myapp.test for local development.")).toEqual([]);
      expect(await lint("Configure service.localhost for testing.")).toEqual([]);
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

    it("does not flag non-domain text", async () => {
      expect(await lint("The variable yourDomain is a string.")).toEqual([]);
    });

    it("does not flag formerly-matched patterns like dummy.io or todo.com", async () => {
      expect(await lint("Use dummy.io as a test endpoint.")).toEqual([]);
      expect(await lint("Check todo.com for tasks.")).toEqual([]);
    });
  });

  describe("invalid", () => {
    it("flags your-domain.com", async () => {
      const messages = await lint(
        "Configure your-domain.com in the DNS settings.",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("your-domain.com");
      expect(messages[0]).toContain("RFC 2606");
    });

    it("flags mydomain.org", async () => {
      const messages = await lint(
        "Set the base URL to mydomain.org for production.",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("mydomain.org");
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

    it("allows RFC 2606 domains in link URLs", async () => {
      expect(
        await lintMd("[docs](https://example.com/docs)"),
      ).toEqual([]);
    });

    it("allows RFC 2606 domains in image URLs", async () => {
      expect(
        await lintMd("![logo](https://example.org/logo.png)"),
      ).toEqual([]);
    });
  });

  describe("ReDoS protection", () => {
    it("skips text nodes exceeding MAX_TEXT_LENGTH", async () => {
      const longText = `${"a".repeat(10_001)} your-domain.com`;
      expect(await lint(longText)).toEqual([]);
    });
  });
});
