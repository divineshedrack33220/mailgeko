import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "@/stores/ui-store";

const reset = () =>
  useUiStore.setState({
    sidebarCollapsed: false,
    commandOpen: false,
    aiOpen: false,
    notificationsOpen: false,
  });

beforeEach(reset);

describe("ui store", () => {
  it("toggles the sidebar collapsed state", () => {
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it("sets sidebar collapsed explicitly", () => {
    useUiStore.getState().setSidebarCollapsed(true);
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().setSidebarCollapsed(false);
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it("opens and closes the command palette", () => {
    useUiStore.getState().setCommandOpen(true);
    expect(useUiStore.getState().commandOpen).toBe(true);
    useUiStore.getState().setCommandOpen(false);
    expect(useUiStore.getState().commandOpen).toBe(false);
  });

  it("tracks the AI panel and notifications drawer independently", () => {
    useUiStore.getState().setAiOpen(true);
    useUiStore.getState().setNotificationsOpen(true);
    expect(useUiStore.getState().aiOpen).toBe(true);
    expect(useUiStore.getState().notificationsOpen).toBe(true);
  });
});
