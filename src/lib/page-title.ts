export function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    campaigns: segments.length > 2 ? "Campaign" : "Campaigns",
    automations: segments.length > 2 ? "Automation" : "Automations",
    contacts: segments.length > 2 ? "Contact" : "Contacts",
    lists: "Lists & Segments",
    templates: segments.length > 2 ? "Template" : "Templates",
    reports: "Reports",
    ai: "AI Studio",
    settings: "Settings",
  };
  return map[segments[0]] ?? "Dashboard";
}
