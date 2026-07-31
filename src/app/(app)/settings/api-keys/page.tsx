"use client";

import * as React from "react";
import {
  Plus,
  Copy,
  Check,
  Trash2,
  MoreHorizontal,
  KeyRound,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDate, timeAgo } from "@/lib/format";
import { apiKeys as initialKeys } from "@/lib/mock";
import type { ApiKey } from "@/lib/types";

const scopeOptions = [
  "campaigns:write",
  "contacts:write",
  "templates:write",
  "automations:write",
  "analytics:read",
  "events:read",
];

export default function ApiKeysSettingsPage() {
  const [keys, setKeys] = React.useState(initialKeys);
  const [keyName, setKeyName] = React.useState("");
  const [scopes, setScopes] = React.useState<string[]>(["campaigns:write", "contacts:write"]);
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const createKey = () => {
    if (!keyName.trim()) return;
    const fakeKey = `mgk_live_${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 6)}`;
    const newKey: ApiKey = {
      id: `k-${Date.now()}`,
      name: keyName.trim(),
      prefix: fakeKey.slice(0, 13),
      scopes,
      createdAt: new Date().toISOString(),
    };
    setKeys((prev) => [newKey, ...prev]);
    setKeyName("");
    setRevealed(newKey.id);
    setRevealedKey(fakeKey);
    navigator.clipboard?.writeText(fakeKey).catch(() => {});
    toast.success("API key created — copy it now, it won't be shown again");
  };

  const revokeKey = (id: string, name: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast.success(`Revoked key "${name}"`);
  };

  const copyPrefix = (id: string, prefix: string) => {
    setCopied(id);
    navigator.clipboard?.writeText(prefix).catch(() => {});
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>API keys</CardTitle>
              <CardDescription>
                Keys authenticate server-side requests to the Mailgeko API.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus /> Create key
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create an API key</DialogTitle>
                  <DialogDescription>
                    Give it a descriptive name and the permissions it needs.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="key-name">Key name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g. Production API"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Scopes</Label>
                    <div className="flex flex-wrap gap-2">
                      {scopeOptions.map((scope) => {
                        const active = scopes.includes(scope);
                        return (
                          <button
                            key={scope}
                            onClick={() =>
                              setScopes((prev) =>
                                active ? prev.filter((s) => s !== scope) : [...prev, scope]
                              )
                            }
                            className={
                              active
                                ? "border-primary bg-primary/10 text-primary rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                                : "border-border text-muted-foreground hover:border-primary/40 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                            }
                          >
                            {scope}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createKey} disabled={!keyName.trim()}>
                    <KeyRound /> Create key
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {keys.map((key) => (
              <div key={key.id} className="hover:bg-muted/40 flex flex-wrap items-center gap-3 px-5 py-4 transition-colors">
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <KeyRound className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{key.name}</p>
                    {revealed === key.id ? (
                      <Badge variant="success">New — copy it now</Badge>
                    ) : (
                      <Badge variant="outline">{key.scopes.length} scopes</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex items-center gap-2 font-mono text-xs">
                    {revealed === key.id ? (
                      <span className="text-foreground">
                        {revealedKey ?? `${key.prefix}•••••••••••••••`}
                      </span>
                    ) : (
                      <button
                        onClick={() => setRevealed(key.id)}
                        className="hover:text-foreground flex items-center gap-1.5 cursor-pointer"
                      >
                        {key.prefix}••••••••••••••• <Eye className="size-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => copyPrefix(key.id, key.prefix)}
                      className="hover:text-foreground cursor-pointer"
                      aria-label="Copy key"
                    >
                      {copied === key.id ? <Check className="text-success size-3.5" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Created {formatDate(key.createdAt)}
                    {key.lastUsed ? ` · Last used ${timeAgo(key.lastUsed)}` : " · Never used"}
                    {key.expiresAt ? ` · Expires ${formatDate(key.expiresAt)}` : ""}
                  </p>
                </div>
                <div className="hidden flex-wrap gap-1 md:flex">
                  {key.scopes.slice(0, 2).map((scope) => (
                    <Badge key={scope} variant="secondary" className="text-[0.65rem]">
                      {scope}
                    </Badge>
                  ))}
                  {key.scopes.length > 2 && (
                    <Badge variant="secondary" className="text-[0.65rem]">
                      +{key.scopes.length - 2}
                    </Badge>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${key.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>{key.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer" onClick={() => setRevealed(key.id)}>
                      <Eye /> Reveal key
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive cursor-pointer"
                      onClick={() => revokeKey(key.id, key.name)}
                    >
                      <Trash2 /> Revoke key
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary size-4" /> Security best practices
          </CardTitle>
          <CardDescription>Keep your keys safe with these tips.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {[
            "Store keys in environment variables, never in client code.",
            "Use a separate key per integration so you can revoke one at a time.",
            "Prefer read-only scopes unless an integration needs to write.",
            "Rotate keys quarterly or after any suspected leak.",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {i + 1}
              </span>
              <p className="text-muted-foreground text-sm">{tip}</p>
            </div>
          ))}
          <div className="bg-warning/10 border-warning/25 flex items-start gap-3 rounded-lg border px-4 py-3">
            <ShieldCheck className="text-warning mt-0.5 size-4 shrink-0" />
            <p className="text-warning text-sm">
              <span className="font-semibold">Heads up:</span> keys are shown in
              full only once at creation. If you lose it, revoke and recreate.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
