
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Connection } from "@/hooks/use-connections";

const connectionSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  baseUrl: z.string().url("URL inválida.").min(1, "A URL base é obrigatória."),
  apiType: z.enum(["wordpress", "generic"]),
  authMethod: z.enum(["none", "bearer", "apiKey"]),
  authToken: z.string().optional(),
  apiKeyHeader: z.string().optional(),
  apiKeyValue: z.string().optional(),
}).refine(data => data.authMethod !== 'bearer' || (data.authToken && data.authToken.length > 0), {
  message: "O Bearer Token é obrigatório.",
  path: ["authToken"],
}).refine(data => data.authMethod !== 'apiKey' || (data.apiKeyHeader && data.apiKeyHeader.length > 0), {
  message: "O nome do header da API Key é obrigatório.",
  path: ["apiKeyHeader"],
}).refine(data => data.authMethod !== 'apiKey' || (data.apiKeyValue && data.apiKeyValue.length > 0), {
  message: "O valor da API Key é obrigatório.",
  path: ["apiKeyValue"],
});


export function ConnectionDialogContent({ onSave, onCancel }: { onSave: (data: Omit<Connection, 'id'>) => void, onCancel: () => void }) {
  const form = useForm<z.infer<typeof connectionSchema>>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      name: "",
      baseUrl: "",
      apiType: "generic",
      authMethod: "none",
      authToken: "",
      apiKeyHeader: "",
      apiKeyValue: "",
    },
  });
  const authMethod = form.watch("authMethod");

  const handleSubmit = form.handleSubmit((data) => {
    onSave(data);
    form.reset();
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Nova Fonte de Dados</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <FormField name="name" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} placeholder="API de Clientes" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField name="baseUrl" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>URL Base</FormLabel><FormControl><Input {...field} placeholder="https://api.example.com" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField name="apiType" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Tipo de API</FormLabel><Select onValuechange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="generic">Genérica (REST)</SelectItem><SelectItem value="wordpress">WordPress</SelectItem></SelectContent></Select><FormMessage /></FormItem>
          )} />
          <FormField name="authMethod" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Autenticação</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">Nenhuma</SelectItem><SelectItem value="bearer">Bearer Token</SelectItem><SelectItem value="apiKey">API Key</SelectItem></SelectContent></Select><FormMessage /></FormItem>
          )} />
          {authMethod === "bearer" && <FormField name="authToken" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Bearer Token</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
          )} />}
          {authMethod === "apiKey" && (
            <>
              <FormField name="apiKeyHeader" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Nome do Header</FormLabel><FormControl><Input {...field} placeholder="X-API-KEY" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="apiKeyValue" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Valor da Key</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" variant="primary">Salvar</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
