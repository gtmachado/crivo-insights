"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getNiches, getInterviews } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, Upload, ChevronRight, ChevronDown,
  Folder, FolderOpen, FileText,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Nova Entrevista", icon: Upload },
];

function NichoTree() {
  const { data: niches = [] } = useQuery({ queryKey: ["niches"], queryFn: getNiches });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  function toggle(niche: string) {
    setExpanded((s) => ({ ...s, [niche]: !s[niche] }));
  }

  return (
    <div className="space-y-0.5">
      {niches.map((niche) => (
        <NichoNode
          key={niche}
          niche={niche}
          expanded={!!expanded[niche]}
          onToggle={() => toggle(niche)}
          pathname={pathname}
        />
      ))}
    </div>
  );
}

function NichoNode({
  niche, expanded, onToggle, pathname,
}: {
  niche: string; expanded: boolean; onToggle: () => void; pathname: string;
}) {
  const { data: interviews = [] } = useQuery({
    queryKey: ["interviews", niche],
    queryFn: () => getInterviews(niche),
    enabled: expanded,
  });

  const nichoHref = `/nicho/${encodeURIComponent(niche)}`;
  const isNichoActive = pathname === nichoHref;

  return (
    <div>
      <div className={cn(
        "flex w-full items-center gap-1 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
        isNichoActive && "bg-accent text-accent-foreground",
      )}>
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-6 h-7 shrink-0 pl-2"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        {expanded
          ? <FolderOpen className="h-4 w-4 shrink-0 text-yellow-500" />
          : <Folder className="h-4 w-4 shrink-0 text-yellow-500" />
        }
        <Link href={nichoHref} className="flex-1 py-1.5 pr-2 truncate font-medium text-sm">
          {niche}
        </Link>
      </div>
      {expanded && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {interviews.map((iv) => {
            const href = `/nicho/${encodeURIComponent(niche)}/${encodeURIComponent(iv.name)}`;
            const active = pathname === href;
            return (
              <Link
                key={iv.name}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
                  active && "bg-accent text-accent-foreground font-medium",
                )}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{iv.name}</span>
              </Link>
            );
          })}
          {interviews.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground/50 italic">vazio</p>
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 glass flex flex-col h-full border-r-0">
      <div className="p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
              pathname === href && "bg-accent text-accent-foreground font-medium",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </div>

      <div className="px-3 pt-4 pb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-2">
          Nichos
        </p>
      </div>

      <ScrollArea className="flex-1 px-3 pb-3">
        <NichoTree />
      </ScrollArea>
    </aside>
  );
}
