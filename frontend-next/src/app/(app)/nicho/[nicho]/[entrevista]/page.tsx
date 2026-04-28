"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getDocument, type DocType, mediaUrl } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { GlossaryPanel } from "@/components/glossary/GlossaryPanel";
import { Loader2, FileText, FileAudio } from "lucide-react";

function MarkdownViewer({ content }: { content: string }) {
  // Renderização simples de markdown — parágrafos, headers, bold, listas
  const lines = content.split("\n");
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      {lines.map((line, i) => {
        if (line.startsWith("# "))   return <h1 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
        if (line.startsWith("## "))  return <h2 key={i} className="text-lg font-semibold mt-5 mb-2 text-primary">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-4 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("| "))   return <div key={i} className="font-mono text-xs text-muted-foreground">{line}</div>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>;
        if (line.trim() === "" || line.trim() === "---") return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm leading-relaxed text-foreground/90">{line}</p>;
      })}
    </div>
  );
}

function DocTab({ niche, interview, doc }: { niche: string; interview: string; doc: DocType }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["doc", niche, interview, doc],
    queryFn: () => getDocument(niche, interview, doc),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (isError || !data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-2">
      <FileText className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Documento ainda não gerado.</p>
    </div>
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <MarkdownViewer content={data} />
      </div>
    </ScrollArea>
  );
}

const DOCS: { key: DocType; label: string }[] = [
  { key: "raw",        label: "01 Bruta"     },
  { key: "refined",    label: "02 Refinada"  },
  { key: "structured", label: "03 Estruturada" },
];

export default function EntrevistaPage() {
  const params = useParams<{ nicho: string; entrevista: string }>();
  const niche     = decodeURIComponent(params.nicho);
  const interview = decodeURIComponent(params.entrevista);

  const [showMedia, setShowMedia] = useState(false);

  const { data: glossaryMd } = useQuery({
    queryKey: ["doc", niche, interview, "glossary"],
    queryFn: () => getDocument(niche, interview, "glossary"),
    staleTime: 5 * 60_000,
  });

  const audioSrc = mediaUrl(niche, interview, "audio.wav");

  return (
    <div className="flex h-full gap-0 -m-6 overflow-hidden">
      {/* Viewer central */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
        <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold truncate">{interview}</h2>
            <p className="text-xs text-muted-foreground">{niche}</p>
          </div>
          <button
            onClick={() => setShowMedia(!showMedia)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileAudio className="h-4 w-4" />
            {showMedia ? "Ocultar" : "Player"}
          </button>
        </div>

        {showMedia && (
          <div className="px-6 py-3 border-b border-border bg-accent/20 shrink-0">
            <audio controls className="w-full h-9" src={audioSrc}>
              Seu browser não suporta player de áudio.
            </audio>
          </div>
        )}

        <Tabs defaultValue="raw" className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 pt-3 shrink-0">
            <TabsList className="h-8">
              {DOCS.map((d) => (
                <TabsTrigger key={d.key} value={d.key} className="text-xs px-3">
                  {d.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="flex-1 overflow-hidden">
            {DOCS.map((d) => (
              <TabsContent key={d.key} value={d.key} className="h-full m-0 data-[state=active]:flex flex-col">
                <DocTab niche={niche} interview={interview} doc={d.key} />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>

      {/* Painel de glossário */}
      <div className="w-64 shrink-0 flex flex-col overflow-hidden">
        {glossaryMd ? (
          <GlossaryPanel markdown={glossaryMd} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
            <FileText className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground text-center">
              Glossário ainda não gerado para esta entrevista.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
