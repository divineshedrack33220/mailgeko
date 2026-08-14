// sanitizePreviewHtml neutralizes browser-executable content that MJML's
// <mj-raw> tag passes through verbatim. The compiled HTML is written into a
// preview popup and reused as send-test overrides, so scripts, event-handler
// attributes and javascript: URLs must never survive compilation. Email
// clients strip these anyway, so the sanitizer only affects previews.
export function sanitizePreviewHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)=(["']?)(javascript:)[^"'\s]*\2?/gi, '$1=""');
}
