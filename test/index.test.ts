import { TextlintKernel } from "@textlint/kernel";
import { parse } from "@textlint/text-to-ast";
import { describe, expect, it } from "vitest";

import rule from "../src/index.js";

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

    it("flags dummy.io", async () => {
      const messages = await lint("Use dummy.io as a test endpoint.");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("dummy.io");
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
  });
});
