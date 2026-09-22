"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createContext, useContext, useEffect } from "react";
import { useForm, type DefaultValues, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { AppSettings, SettingsKey } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { updateSettings } from "@/services/settings";
import { cn } from "@/lib/utils";

/** Loaded settings, provided by the settings page so forms start with real values on first render. */
export const SettingsValueContext = createContext<AppSettings | null>(null);

/** RHF form bound to one settings section. Re-syncs from storage unless the user has unsaved edits. */
export function useSettingsForm<K extends SettingsKey, S extends z.ZodType<AppSettings[K], FieldValues>>(key: K, schema: S) {
  const settings = useContext(SettingsValueContext);
  if (!settings) throw new Error("useSettingsForm must be used inside SettingsValueContext");
  const value = settings[key];
  const form = useForm<z.input<S>, unknown, AppSettings[K]>({ resolver: zodResolver(schema) as never, defaultValues: value as DefaultValues<z.input<S>> });
  const save = useAction(updateSettings, { success: "Settings saved" });
  const json = JSON.stringify(value);

  useEffect(() => {
    if (value && !form.formState.isDirty) form.reset(value as z.input<S>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json]);

  const onSubmit = form.handleSubmit(async (values) => {
    const ok = await save.run(key, values);
    if (ok !== undefined) form.reset(values as z.input<S>);
  });

  return { form, onSubmit, pending: save.pending, loaded: !!value };
}

export function SettingsCard({ title, description, children, footer, className }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-xs", className)}>
      <header className="border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="p-5">{children}</div>
      {footer && <footer className="flex items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">{footer}</footer>}
    </section>
  );
}

export function SaveFooter<T extends FieldValues>({ form, pending }: { form: UseFormReturn<T, unknown, never> | UseFormReturn<T, unknown, T> | UseFormReturn<T>; pending: boolean }) {
  const dirty = form.formState.isDirty;
  return (
    <>
      {dirty && <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>}
      <Button type="button" variant="ghost" disabled={!dirty || pending} onClick={() => form.reset()}>Discard</Button>
      <Button type="submit" disabled={!dirty || pending}>{pending ? "Saving…" : "Save changes"}</Button>
    </>
  );
}

type AnyForm<T extends FieldValues> = UseFormReturn<T, unknown, never> | UseFormReturn<T, unknown, T> | UseFormReturn<T>;

export function TextField<T extends FieldValues>({ form, name, label, description, placeholder, className, prefix, suffix, type = "text", upper }: {
  form: AnyForm<T>;
  name: FieldPath<T>;
  label: string;
  description?: React.ReactNode;
  placeholder?: string;
  className?: string;
  prefix?: string;
  suffix?: string;
  type?: "text" | "number" | "email" | "tel";
  upper?: boolean;
}) {
  const numeric = type === "number";
  return (
    <FormField
      control={form.control as UseFormReturn<T>["control"]}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <div className="relative">
            {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
            <FormControl>
              <Input
                {...field}
                value={typeof field.value === "number" && Number.isNaN(field.value) ? "" : (field.value ?? "")}
                type={type === "number" ? "text" : type}
                inputMode={numeric ? "decimal" : undefined}
                placeholder={placeholder}
                onChange={(e) => {
                  const v = e.target.value;
                  if (numeric) field.onChange(v === "" ? Number.NaN : Number(v.replace(/[^\d.]/g, "")));
                  else field.onChange(upper ? v.toUpperCase() : v);
                }}
                className={cn(prefix && "pl-7", suffix && "pr-16", numeric && "tabular")}
              />
            </FormControl>
            {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
          </div>
          {description && <FormDescription className="text-xs">{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({ form, name, label, description }: { form: AnyForm<T>; name: FieldPath<T>; label: string; description?: React.ReactNode }) {
  return (
    <FormField
      control={form.control as UseFormReturn<T>["control"]}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-0.5">
            <FormLabel>{label}</FormLabel>
            {description && <FormDescription className="text-xs">{description}</FormDescription>}
          </div>
          <FormControl>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
