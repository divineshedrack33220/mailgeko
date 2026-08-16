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

  it("neutralizes entity-encoded javascript: URLs", () => {
    const out = sanitizePreviewHtml('<a href="jav&#x61;script:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href=""');
  });

  it("neutralizes control-char-obfuscated javascript: URLs", () => {
    expect(sanitizePreviewHtml('<a href="jav\tascript:alert(1)">x</a>')).not.toContain(
      "javascript:"
    );
    expect(sanitizePreviewHtml('<img src="jav&#x09;ascript:alert(2)">')).not.toContain(
      "javascript:"
    );
  });

  it("removes script inside comments before it can be reparsed", () => {
    const out = sanitizePreviewHtml("<!-- <script>alert(1)</script> --><p>ok</p>");
    expect(out).not.toContain("<script");
    expect(out).toContain("<p>ok</p>");
  });

  it("removes split script tags", () => {
    const out = sanitizePreviewHtml("<scr<script>ipt>alert(1)</script>");
    expect(out).not.toContain("script");
  });

  it("removes svg/object/embed script carriers and event handlers", () => {
    expect(sanitizePreviewHtml('<svg onload="alert(1)"></svg>')).not.toContain("onload");
    expect(sanitizePreviewHtml("<object data=\"https://evil.example/x\"></object>")).not.toContain(
      "object"
    );
    expect(sanitizePreviewHtml("<embed src=\"x.swf\">")).not.toContain("embed");
  });

  it("keeps data:image URLs", () => {
    const html = '<img src="data:image/png;base64,iVBORw0KGgo=">';
    expect(sanitizePreviewHtml(html)).toBe(html);
  });
});
