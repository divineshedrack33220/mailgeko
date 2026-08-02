const NAME_KEY = "mailgeko_visitor_name";
const EMAIL_KEY = "mailgeko_visitor_email";

function firstWordUpper(name: string): string | null {
  const word = name?.trim().split(/\s+/)[0];
  return word ? word.toUpperCase() : null;
}

export function getVisitorFromUrl(): { name?: string; email?: string } {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const name = firstWordUpper(params.get("name") || params.get("first_name") || "");
  const email = params.get("email") || "";
  return { name: name ?? undefined, email: email || undefined };
}

export function getStoredVisitor(): { name?: string; email?: string } {
  if (typeof window === "undefined") return {};
  const name = firstWordUpper(window.localStorage.getItem(NAME_KEY) ?? "");
  const email = window.localStorage.getItem(EMAIL_KEY) ?? "";
  return { name: name ?? undefined, email: email || undefined };
}

export function rememberVisitor(name?: string | null, email?: string | null): void {
  if (typeof window === "undefined") return;
  if (name) window.localStorage.setItem(NAME_KEY, name);
  if (email) window.localStorage.setItem(EMAIL_KEY, email);
}
