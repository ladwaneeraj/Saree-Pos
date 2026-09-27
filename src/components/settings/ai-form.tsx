"use client";

import { ShieldAlert } from "lucide-react";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { SaveFooter, SettingsCard, TextField, useSettingsForm } from "./settings-kit";

const schema = z.object({
  anthropicApiKey: z.string().trim(),
  model: z.string().trim().min(1, "Enter a model id"),
});

export function AiForm() {
  const { form, onSubmit, pending } = useSettingsForm("ai", schema);
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <SettingsCard title="AI bill reading" description="Scan a supplier bill on the purchase form and Claude fills in the supplier, items, quantities, rates and GST for you to check." footer={<SaveFooter form={form} pending={pending} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="anthropicApiKey" label="Claude API key" placeholder="sk-ant-…" className="sm:col-span-2" description="From console.anthropic.com. Each scan costs a few paise to a rupee depending on the bill." />
            <TextField form={form} name="model" label="Model" placeholder="claude-sonnet-4-5" description="Any current Claude model that reads images and PDFs." />
          </div>
          <div className="mt-4 flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>The key is stored in this browser&apos;s local database, unencrypted, and is sent only to api.anthropic.com. Anyone with access to this computer and the owner login can read it. Use a key with a spending limit, and remove it here if the computer changes hands.</p>
          </div>
        </SettingsCard>
      </form>
    </Form>
  );
}
