
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
  apiType: z.enum(["Generic", "WordPress"]),
  auth: z.discriminatedUnion("type", [
    z.object({ type: z.literal("none") }),
    z.object({
      type: z.literal("basic"),
      username: z.string().min(1, "O usuário é obrigatório."),
      password: z.string().min(1, "A senha de aplicação é obrigatória."),
    }),
    z.object({
      type: z.literal("bearer"),
      token: z.string().min(1, "O Bearer Token é obrigatório."),
    }),
    z.object({
      type: z.literal("apiKey"),
      headerName: z.string().min(1, "O nome do header é obrigatório."),
      apiKey: z.string().min(1, "O valor da API Key é obrigatório."),
    }),
     z.object({
      type: z.literal("wooCommerce"),
      consumerKey: z.string().min(1, "A Consumer Key é obrigatória."),
      consumerSecret: z.string().min(1, "A Consumer Secret é obrigatória."),
    }),
  ]),
});


export function ConnectionDialogContent({ onSave, onCancel }: { onSave: (data: Omit<Connection, 'id'>) => void, onCancel: () => void }) {
  const form = useForm<z.infer<typeof connectionSchema>>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      name: "",
      baseUrl: "",
      apiType: "Generic",
      auth: {
        type: "none",
        username: "",
        password: "",
        token: "",
        headerName: "",
        apiKey: "",
        consumerKey: "",
        consumerSecret: "",
      },
    },
  });
  
  const authType = form.watch("auth.type");
  const apiType = form.watch("apiType");

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
            <FormItem><FormLabel>Tipo de API</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Generic">Genérica</SelectItem><SelectItem value="WordPress">WordPress / WooCommerce</SelectItem></SelectContent></Select><FormMessage /></FormItem>
          )} />
          
          <FormField name="auth.type" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Autenticação</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              <SelectItem value="basic">WordPress Basic Auth</SelectItem>
              <SelectItem value="wooCommerce">WooCommerce API Keys</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="apiKey">API Key (Header)</SelectItem>
            </SelectContent></Select><FormMessage /></FormItem>
          )} />
          
          {authType === "bearer" && <FormField name="auth.token" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Bearer Token</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
          )} />}

          {authType === "basic" && (
            <>
              <FormField name="auth.username" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Usuário</FormLabel><FormControl><Input {...field} placeholder="user" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="auth.password" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Senha de Aplicação</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </>
          )}
          
          {authType === "apiKey" && (
            <>
              <FormField name="auth.headerName" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Nome do Header</FormLabel><FormControl><Input {...field} placeholder="X-API-KEY" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="auth.apiKey" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Valor da Key</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </>
          )}

           {authType === "wooCommerce" && (
            <>
              <FormField name="auth.consumerKey" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Consumer Key</FormLabel><FormControl><Input {...field} placeholder="ck_..." /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="auth.consumerSecret" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Consumer Secret</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
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
