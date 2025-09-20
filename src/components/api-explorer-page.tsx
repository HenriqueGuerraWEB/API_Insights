"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import useLocalStorage from "@/hooks/use-local-storage";
import { fetchApiData, exportData, FetchApiDataOutput } from "@/app/actions";
import {
  Plus,
  Database,
  Trash2,
  Settings,
  Wand2,
  AlertCircle,
  Play,
  FileDown,
  Columns,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Code,
  Rocket,
  FileJson,
  Sheet as SheetIcon,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
type Connection = {
  id: string;
  name: string;
  baseUrl: string;
  authMethod: "none" | "bearer" | "apiKey";
  authToken?: string;
  apiKeyHeader?: string;
  apiKeyValue?: string;
};

type Column = {
  key: string;
  friendlyName: string;
  visible: boolean;
  order: number;
};

const connectionSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  baseUrl: z.string().min(1, "A URL base é obrigatória."),
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

const queryParamsSchema = z.object({
  params: z.array(z.object({ key: z.string(), value: z.string() })),
  headers: z.array(z.object({ key: z.string(), value: z.string() })),
});

// Main Component
export default function ApiExplorerPage() {
  const [connections, setConnections] = useLocalStorage<Connection[]>("api-connections", []);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<FetchApiDataOutput | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [isColumnManagerOpen, setColumnManagerOpen] = useState(false);
  
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const queryForm = useForm<{ method: string, path: string, body: string, params: {key:string, value:string}[], headers: {key:string, value:string}[] }>({
    defaultValues: { method: "GET", path: "", body: "", params: [], headers: [] },
  });

  const activeConnection = useMemo(
    () => connections.find(c => c.id === activeConnectionId),
    [connections, activeConnectionId]
  );
  
  const sortedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns]);
  const visibleColumns = useMemo(() => sortedColumns.filter(c => c.visible), [sortedColumns]);

  const handleExecuteQuery = queryForm.handleSubmit(async (values) => {
    if (!activeConnection) {
      toast({ variant: "destructive", title: "Nenhuma conexão selecionada." });
      return;
    }

    startTransition(async () => {
      setApiResponse(null);
      
      const url = new URL(activeConnection.baseUrl);
      url.pathname = values.path;
      values.params.forEach(p => p.key && url.searchParams.append(p.key, p.value));

      const finalHeaders: Record<string, string> = { "Content-Type": "application/json" };
      values.headers.forEach(h => h.key && (finalHeaders[h.key] = h.value));

      if (activeConnection.authMethod === 'bearer' && activeConnection.authToken) {
        finalHeaders['Authorization'] = `Bearer ${activeConnection.authToken}`;
      } else if (activeConnection.authMethod === 'apiKey' && activeConnection.apiKeyHeader && activeConnection.apiKeyValue) {
        finalHeaders[activeConnection.apiKeyHeader] = activeConnection.apiKeyValue;
      }
      
      const result = await fetchApiData({
        url: url.toString(),
        method: values.method,
        headers: finalHeaders,
        body: values.body,
      });

      if (result.error) {
        setApiResponse({ data: null, suggestedNames: {}, error: result.error });
      } else {
        setApiResponse(result);
        const newColumns = Object.keys(result.suggestedNames).map((key, index) => ({
          key,
          friendlyName: result.suggestedNames[key] || key,
          visible: true,
          order: index,
        }));
        setColumns(newColumns);
      }
    });
  });

  const handleExport = async (format: "json" | "csv" | "pdf") => {
    if (!apiResponse?.data || visibleColumns.length === 0) {
      toast({ variant: "destructive", title: "Não há dados para exportar." });
      return;
    }

    startTransition(async () => {
      const exportCols = visibleColumns.map(c => ({ key: c.key, name: c.friendlyName }));
      const result = await exportData({ data: apiResponse.data, columns: exportCols, format });

      if (result.error) {
        toast({ variant: "destructive", title: "Erro na Exportação", description: result.error });
      } else {
        const blob = new Blob([result.content], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Exportação Concluída", description: `${result.fileName} foi baixado.` });
      }
    });
  };

  const updateColumnOrder = (index: number, direction: 'up' | 'down') => {
    const newColumns = [...columns];
    const item = newColumns[index];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (swapIndex < 0 || swapIndex >= newColumns.length) return;

    const [swappedItem] = newColumns.splice(swapIndex, 1, item);
    newColumns.splice(index, 1, swappedItem);
    
    setColumns(newColumns.map((col, idx) => ({ ...col, order: idx })));
  };


  const addConnection = (conn: Omit<Connection, "id">) => {
    const newConnection = { ...conn, id: uuidv4() };
    setConnections([...connections, newConnection]);
    setActiveConnectionId(newConnection.id);
  };
  
  const deleteConnection = (id: string) => {
    setConnections(connections.filter(c => c.id !== id));
    if (activeConnectionId === id) {
      setActiveConnectionId(null);
    }
  };

  const GlassCard = ({ className, ...props }: React.ComponentProps<typeof Card>) => (
    <Card className={cn("bg-card/60 backdrop-blur-lg border-border/30", className)} {...props} />
  );

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <Rocket className="text-primary size-7" />
            <h2 className="text-xl font-semibold text-primary-foreground font-headline">API Insights</h2>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-0">
          <ScrollArea className="h-full">
            <SidebarMenu className="p-4">
              <SidebarMenuItem className="mb-2">
                 <ConnectionDialog onSave={addConnection} />
              </SidebarMenuItem>
              {connections.map(conn => (
                <SidebarMenuItem key={conn.id}>
                  <SidebarMenuButton 
                    onClick={() => setActiveConnectionId(conn.id)}
                    isActive={activeConnectionId === conn.id}
                    className="justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Database className="size-4" />
                      <span className="truncate">{conn.name}</span>
                    </div>
                  </SidebarMenuButton>
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => deleteConnection(conn.id)}>
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t border-border/30">
            <p className="text-xs text-muted-foreground">Construído com Next.js e GenAI.</p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col h-screen">
          {/* Query Builder Panel */}
          <div className="p-4 border-b border-border/30">
            <QueryBuilderForm form={queryForm} onSubmit={handleExecuteQuery} isPending={isPending} activeConnection={activeConnection} />
          </div>

          {/* Results Panel */}
          <div className="flex-1 p-4 overflow-hidden">
             <GlassCard className="h-full flex flex-col">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Resultados</CardTitle>
                  <CardDescription>Dados retornados da sua consulta.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                   <ColumnManagerDrawer 
                    columns={columns} 
                    setColumns={setColumns} 
                    isOpen={isColumnManagerOpen} 
                    setIsOpen={setColumnManagerOpen}
                    onOrderChange={updateColumnOrder}
                    />
                    <ExportDropdown onExport={handleExport} isPending={isPending} />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {isPending && !apiResponse && <LoadingState />}
                {apiResponse?.error && <ErrorState message={apiResponse.error} />}
                {!isPending && !apiResponse && <InitialState />}
                {apiResponse?.data && apiResponse.data.length > 0 && (
                   <DataTable data={apiResponse.data} columns={visibleColumns} />
                )}
                {apiResponse?.data && apiResponse.data.length === 0 && <p>A consulta foi bem-sucedida, mas não retornou dados.</p>}
              </CardContent>
            </GlassCard>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Sub-components
function ConnectionDialog({ onSave }: { onSave: (data: Omit<Connection, 'id'>) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<z.infer<typeof connectionSchema>>({
    resolver: zodResolver(connectionSchema),
    defaultValues: { name: "", baseUrl: "", authMethod: "none" },
  });
  const authMethod = form.watch("authMethod");

  const handleSubmit = form.handleSubmit((data) => {
    onSave(data);
    form.reset();
    setIsOpen(false);
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="mr-2 size-4" /> Nova Conexão
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card/80 backdrop-blur-xl border-border/50">
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
                <FormItem><FormLabel>URL Base</FormLabel><FormControl><Input {...field} placeholder="https://api.example.com/v1" /></FormControl><FormMessage /></FormItem>
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
              <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function QueryBuilderForm({ form, onSubmit, isPending, activeConnection }: { form: any, onSubmit: () => void, isPending: boolean, activeConnection: Connection | undefined }) {
  const { fields: params, append: appendParam, remove: removeParam } = useFieldArray({ control: form.control, name: "params" });
  const { fields: headers, append: appendHeader, remove: removeHeader } = useFieldArray({ control: form.control, name: "headers" });
  
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <div className="flex gap-4 items-end">
          <FormField name="method" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Método</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem><SelectItem value="PUT">PUT</SelectItem><SelectItem value="DELETE">DELETE</SelectItem></SelectContent></Select></FormItem>
          )} />
          <FormField name="path" control={form.control} render={({ field }) => (
            <FormItem className="flex-1"><FormLabel>Endpoint</FormLabel><FormControl><div className="flex items-center"><span className="p-2 rounded-l-md bg-muted text-muted-foreground text-sm">{activeConnection?.baseUrl || 'Selecione uma conexão'}</span><Input {...field} placeholder="/users" className="rounded-l-none" /></div></FormControl></FormItem>
          )} />
          <Button type="submit" disabled={isPending || !activeConnection} className="h-10">
            {isPending ? <Wand2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Executar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
           <div>
              <h4 className="font-semibold mb-2">Parâmetros</h4>
              <ScrollArea className="h-32 pr-4">
                {params.map((field, index) => (
                  <div key={field.id} className="flex gap-2 mb-2">
                    <Input {...form.register(`params.${index}.key`)} placeholder="key" className="h-8" />
                    <Input {...form.register(`params.${index}.value`)} placeholder="value" className="h-8" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeParam(index)}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
              </ScrollArea>
              <Button type="button" variant="outline" size="sm" onClick={() => appendParam({ key: "", value: "" })} className="mt-2 w-full">Adicionar Parâmetro</Button>
           </div>
           <div>
              <h4 className="font-semibold mb-2">Headers</h4>
              <ScrollArea className="h-32 pr-4">
                {headers.map((field, index) => (
                   <div key={field.id} className="flex gap-2 mb-2">
                    <Input {...form.register(`headers.${index}.key`)} placeholder="key" className="h-8"/>
                    <Input {...form.register(`headers.${index}.value`)} placeholder="value" className="h-8"/>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeHeader(index)}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
              </ScrollArea>
              <Button type="button" variant="outline" size="sm" onClick={() => appendHeader({ key: "", value: "" })} className="mt-2 w-full">Adicionar Header</Button>
           </div>
           <div>
             <h4 className="font-semibold mb-2">Body (JSON)</h4>
             <FormField name="body" control={form.control} render={({ field }) => (
                <FormItem><FormControl><Textarea {...field} placeholder={`{\n  "key": "value"\n}`} className="font-code h-32" /></FormControl></FormItem>
              )} />
           </div>
        </div>
      </form>
    </Form>
  );
}

function DataTable({ data, columns }: { data: any[]; columns: Column[] }) {
  const headers = useMemo(() => columns.map(col => <TableHead key={col.key}>{col.friendlyName}</TableHead>), [columns]);
  
  const rows = useMemo(() => data.map((row, rowIndex) => (
    <TableRow key={rowIndex}>
      {columns.map(col => (
        <TableCell key={`${rowIndex}-${col.key}`} className="font-code text-sm max-w-xs truncate">
          {typeof row[col.key] === 'object' && row[col.key] !== null ? JSON.stringify(row[col.key]) : String(row[col.key] ?? '')}
        </TableCell>
      ))}
    </TableRow>
  )), [data, columns]);

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader><TableRow>{headers}</TableRow></TableHeader>
        <TableBody>{rows}</TableBody>
      </Table>
    </ScrollArea>
  );
}

function ColumnManagerDrawer({ columns, setColumns, isOpen, setIsOpen, onOrderChange }: { columns: Column[], setColumns: (cols: Column[]) => void, isOpen: boolean, setIsOpen: (open: boolean) => void, onOrderChange: (index: number, direction: 'up' | 'down') => void }) {
  
  const handleVisibilityChange = (key: string, visible: boolean) => {
    setColumns(columns.map(c => c.key === key ? { ...c, visible } : c));
  };

  const handleNameChange = (key: string, friendlyName: string) => {
    setColumns(columns.map(c => c.key === key ? { ...c, friendlyName } : c));
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline"><Columns className="mr-2 size-4" /> Gerenciar Colunas</Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md bg-card/80 backdrop-blur-xl border-border/50">
        <SheetHeader>
          <SheetTitle>Gerenciar Colunas</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
          <div className="space-y-4">
            {columns.map((col, index) => (
              <div key={col.key} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                 <div className="flex flex-col">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOrderChange(index, 'up')} disabled={index === 0}><ArrowUp className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOrderChange(index, 'down')} disabled={index === columns.length - 1}><ArrowDown className="size-4" /></Button>
                </div>
                <div className="flex-1 space-y-1">
                  <Input value={col.friendlyName} onChange={(e) => handleNameChange(col.key, e.target.value)} />
                  <p className="text-xs text-muted-foreground font-code">{col.key}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleVisibilityChange(col.key, !col.visible)}>
                  {col.visible ? <Eye className="size-4" /> : <EyeOff className="size-4 text-muted-foreground" />}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ExportDropdown({ onExport, isPending }: { onExport: (format: "json" | "csv" | "pdf") => void, isPending: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button><FileDown className="mr-2 size-4" /> Exportar</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onExport("json")} disabled={isPending}><FileJson className="mr-2 size-4" /> JSON</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("csv")} disabled={isPending}><SheetIcon className="mr-2 size-4" /> CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("pdf")} disabled={isPending}><FileText className="mr-2 size-4" /> PDF (em breve)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center h-full text-center">
    <div className="relative w-24 h-24">
      <div className="absolute inset-0 border-2 border-primary/30 rounded-full"></div>
      <div className="absolute inset-2 border-t-2 border-primary rounded-full animate-spin"></div>
    </div>
    <p className="mt-4 text-lg font-semibold text-primary-foreground">Buscando dados...</p>
    <p className="text-muted-foreground flex items-center gap-2 mt-1">
      <Wand2 className="size-4 text-primary" /> IA analisando a estrutura...
    </p>
  </div>
);

const ErrorState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center h-full">
    <Alert variant="destructive" className="max-w-md">
      <AlertCircle className="size-4" />
      <AlertTitle>Ocorreu um Erro</AlertTitle>
      <AlertDescription className="font-code">{message}</AlertDescription>
    </Alert>
  </div>
);

const InitialState = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-8">
     <Rocket className="size-16 mb-4 text-primary/50" />
    <h3 className="text-2xl font-bold font-headline">Bem-vindo ao API Insights</h3>
    <p className="mt-2 max-w-md text-muted-foreground">
      Conecte-se a uma fonte de dados, execute uma consulta e comece a explorar.
      Seu assistente de IA está pronto para ajudar.
    </p>
  </div>
);
