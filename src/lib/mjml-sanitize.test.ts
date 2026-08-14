import { describe, expect, it } from "vitest";
import { sanitizePreviewHtml } from "./mjml-sanitize";

describe("sanitizePreviewHtml", () => {
  it("removes script blocks", () => {
    const html = '<mj-text>hi</mj-text><script>alert(1)</script>';
    expect(sanitizePreviewHtml(html)).not.toContain("<script");
    expect(sanitizePreviewHtml(html)).toContain("mj-text");
  });

  it("removes script blocks with any casing and attributes", () => {
    const html = '<SCRIPT src="https://evil.example/x.js"></SCRIPT>';
    expect(sanitizePreviewHtml(html)).toBe("");
  });

  it("removes inline event handlers", () => {
    const html = '<a href="https://ok.example" onclick="steal()">go</a>';
    const out = sanitizePreviewHtml(html);
    expect(out).not.toContain("onclick");
    expect(out).toContain('href="https://ok.example"');
  });

  it("removes single-quoted and unquoted event handlers", () => {
    expect(sanitizePreviewHtml("<img onerror='x()' src='a.png'>")).not.toContain("onerror");
    expect(sanitizePreviewHtml("<img onerror=x() src=a.png>")).not.toContain("onerror");
  });

  it("neutralizes javascript: URLs in href and src", () => {
    expect(sanitizePreviewHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    expect(sanitizePreviewHtml("<img src=javascript:alert(2)>")).not.toContain("javascript:");
  });

  it("keeps legitimate hrefs and markup intact", () => {
    const html = '<a href="https://example.com/path?q=1">link</a>';
    expect(sanitizePreviewHtml(html)).toBe(html);
  });

  it("removes iframes", () => {
    const html = "<p>body</p><iframe src=\"https://evil.example\"></iframe>";
    expect(sanitizePreviewHtml(html)).toBe("<p>body</p>");
  });
});
