// sanitizePreviewHtml neutralizes browser-executable content that MJML's
// <mj-raw> tag passes through verbatim. The compiled HTML is written into a
// preview popup (sandboxed iframe) and reused as send-test overrides, so
// scripts, event-handler attributes and javascript: URLs must never survive
// compilation. Email clients strip these anyway, so the sanitizer only
// affects previews.
//
// The browser strips ASCII tab/newline/CR inside URLs before parsing them and
// decodes character references in attribute values before treating the value
// as a URL, so a scheme check that ignores either is trivially bypassable
// (`jav&#x61;script:` or `jav\tascript:`). We remove control characters up
// front, then decode references inside each URL-bearing attribute value before
// inspecting it. The in-page preview and the popup are additionally rendered
// inside a sandboxed iframe, so even a missed edge case cannot execute.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\t\n\r]/g;

// URL-bearing attributes whose scheme we validate. Includes formaction (a form
// can POST anywhere) and background/xlink:href (legacy script carriers).
const URL_ATTR_RE = /\s(href|src|xlink:href|xmlns|formaction|action|background|poster)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

function decodeReferences(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&colon;/gi, ":")
    .replace(/&Tab;/gi, " ")
    .replace(/&NewLine;/gi, " ");
}

export function sanitizePreviewHtml(html: string): string {
  return html
    .replace(CONTROL_RE, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*script[\s\S]*?<\/\s*script\s*>/gi, "")
    .replace(/<\s*script[^>]*>/gi, "")
    .replace(/<\s*iframe[\s\S]*?<\/\s*iframe\s*>/gi, "")
    .replace(/<\s*iframe[^>]*>/gi, "")
    .replace(/<\s*object[\s\S]*?<\/\s*object\s*>/gi, "")
    .replace(/<\s*object[^>]*>/gi, "")
    .replace(/<\s*embed\s*[^>]*>/gi, "")
    .replace(/<\s*base\s*[^>]*>/gi, "")
    .replace(/<meta[^>]*http-equiv[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(URL_ATTR_RE, (match, name: string, value: string) => {
      const scheme = decodeReferences(value.replace(/^["']|["']$/g, "")).trim().toLowerCase();
      if (
        scheme.startsWith("javascript:") ||
        scheme.startsWith("vbscript:") ||
        scheme.startsWith("data:text/html") ||
        scheme.startsWith("data:text/javascript")
      ) {
        return ` ${name}=""`;
      }
      return match;
    });
}
