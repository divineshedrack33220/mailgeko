"use client";

import Link from "next/link";
import { ChevronRight, LifeBuoy, MessageCircleQuestion } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

export function SupportFab() {
  const aiOpen = useUiStore((s) => s.aiOpen);
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
              Check the docs or open a support ticket.
            </p>
          </div>
          <div className="border-t p-1.5">
            <Link
              href="/settings"
              className="hover:bg-muted flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors"
            >
              <MessageCircleQuestion className="text-muted-foreground size-4" />
              Check the docs
              <ChevronRight className="text-muted-foreground ml-auto size-4" />
            </Link>
            <Link
              href="/settings"
              className="hover:bg-muted flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors"
            >
              <LifeBuoy className="text-muted-foreground size-4" />
              Contact support
              <ChevronRight className="text-muted-foreground ml-auto size-4" />
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
