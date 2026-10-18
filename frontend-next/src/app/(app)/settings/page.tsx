"use client";

import { PageContainer, PageHeader } from "@/components/common/PageHeader";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { ConnectionSettings } from "@/components/settings/ConnectionSettings";
import { ModelSettings } from "@/components/settings/ModelSettings";
import { PromptSettings } from "@/components/settings/PromptSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Configurações"
        description="Conexão com o backend, modelos de IA, prompts e aparência."
      />
      <Tabs defaultValue="connection">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="connection">Conexão</TabsTrigger>
          <TabsTrigger value="models">Modelos</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
        </TabsList>
        <TabsContent value="connection" className="max-w-2xl">
          <ConnectionSettings />
        </TabsContent>
        <TabsContent value="models" className="max-w-2xl">
          <ModelSettings />
        </TabsContent>
        <TabsContent value="prompts">
          <PromptSettings />
        </TabsContent>
        <TabsContent value="appearance" className="max-w-2xl">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
