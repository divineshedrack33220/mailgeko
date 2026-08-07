"use client";

import { ChevronRight, LifeBuoy, Sparkles, Bug } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

export function SupportFab() {
  const aiOpen = useUiStore((s) => s.aiOpen);
  const setAiOpen = useUiStore((s) => s.setAiOpen);
  if (aiOpen) return null;

  return (
    <div className="fixed right-5 bottom-5 z-50">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            aria-label="Need a hand?"
            className="shadow-lg"
            size="icon"
          >
            <LifeBuoy className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={12}
          className="w-72 p-0"
        >
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                <LifeBuoy className="size-4" />
              </span>
              <p className="text-sm font-semibold">Need a hand?</p>
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Ask the AI assistant, or report an issue on GitHub.
            </p>
          </div>
          <div className="border-t p-1.5">
            <button
              onClick={() => setAiOpen(true)}
              className="hover:bg-muted flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors"
            >
              <Sparkles className="text-muted-foreground size-4" />
              Open AI assistant
              <ChevronRight className="text-muted-foreground ml-auto size-4" />
            </button>
            <a
              href="https://github.com/divineshedrack33220/mailgeko/issues"
              target="_blank"
              rel="noreferrer"
              className="hover:bg-muted flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors"
            >
              <Bug className="text-muted-foreground size-4" />
              Report an issue
              <ChevronRight className="text-muted-foreground ml-auto size-4" />
            </a>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
