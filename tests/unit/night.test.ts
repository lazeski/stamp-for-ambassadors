import { describe, expect, it } from "vitest";
import { parseHttpUrl } from "@/lib/night";

describe("parseHttpUrl", () => {
  it("treats a blank as no link", () => {
    expect(parseHttpUrl("  ", "The product link")).toEqual({ ok: null });
    expect(parseHttpUrl(null, "The product link")).toEqual({ ok: null });
  });

  it("keeps an http or https link", () => {
    expect(parseHttpUrl("https://github.com/acme/app", "The GitHub link")).toEqual({
      ok: "https://github.com/acme/app",
    });
  });

  it("refuses a link that is not a web address", () => {
    expect(parseHttpUrl("github.com/acme/app", "The GitHub link")).toEqual({
      error: "The GitHub link needs a full link, starting with https://",
    });
    expect(parseHttpUrl("javascript:alert(1)", "The product link")).toEqual({
      error: "The product link needs a full link, starting with https://",
    });
  });
});
