

"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
  AlertCircle,
  Play,
  FileDown,
  Columns,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  FileJson,
  Sheet as SheetIcon,
  FileText,
  Sparkles,
  Rocket
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionDialog } from "@/components/connection-dialog";


export type Connection = {
  id: string;
  name: string;
  baseUrl: string;
  authMethod: "none" | "bearer" | "apiKey";
  authToken?: string;
  apiKeyHeader?: string;
  apiKeyValue?: string;
};

const PageContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="flex-1 flex flex-col gap-4 p-4">
    {children}
  </div>
);

function ConnectionItem({ 
  connection, 
  isActive, 
  onSelect, 
  onDelete 
}: { 
  connection: Connection; 
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(connection.id);
  };
  
  return (
    <SidebarMenuItem key={connection.id} className="w-full relative group/item">
      <SidebarMenuButton
        onClick={() => onSelect(connection.id)}
        isActive={isActive}
        className="justify-center"
        tooltip={connection.name}
      >
        <Database className="size-4" />
      </SidebarMenuButton>
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute right-[-35px] top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover/item:opacity-100 transition-opacity" 
        onClick={handleDelete}>
        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </SidebarMenuItem>
  );
}

// Main Component
export default function ApiExplorerPage() {
  const [connections, setConnections] = useLocalStorage<Connection[]>("api-connections", []);
  const [activeConnectionId, setActiveConnectionId] = useLocalStorage<string | null>("active-connection-id", null);
  const [apiResponse, setApiResponse] = useState<FetchApiDataOutput | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  
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
  
  const handleSetActiveConnection = useCallback((id: string) => {
    setActiveConnectionId(id);
  }, [setActiveConnectionId]);

  const addConnection = useCallback((conn: Omit<Connection, "id">) => {
    setConnections(prev => {
        const newConnection = { ...conn, id: uuidv4() };
        const updatedConnections = [...prev, newConnection];
        setActiveConnectionId(newConnection.id);
        return updatedConnections;
    });
  }, [setConnections, setActiveConnectionId]);

  const deleteConnection = useCallback((id: string) => {
    setConnections(prev => {
      const newConnections = prev.filter(c => c.id !== id);
      if (activeConnectionId === id) {
        setActiveConnectionId(newConnections.length > 0 ? newConnections[0].id : null);
      }
      return newConnections;
    });
  }, [activeConnectionId, setConnections, setActiveConnectionId]);


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
  
  return (
    <SidebarProvider>
        <div className="flex h-screen bg-background text-foreground">
            <Sidebar variant="inset" collapsible="icon">
                <SidebarHeader className="p-4 flex justify-center">
                <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg border border-primary/20">
                    <Rocket className="size-5 text-primary" />
                </div>
                </SidebarHeader>
                <SidebarContent className="p-0">
                <ScrollArea className="h-full">
                    <SidebarMenu className="p-4 flex flex-col items-center gap-2">
                    <SidebarMenuItem className="w-full">
                        <ConnectionDialog onSave={addConnection}>
                            <Button variant="primary" className="w-full justify-center" tooltip="Nova Conexão">
                                <Plus className="size-4" />
                            </Button>
                        </ConnectionDialog>
                    </SidebarMenuItem>
                    {connections.map(conn => (
                        <ConnectionItem
                        key={conn.id}
                        connection={conn}
                        isActive={activeConnectionId === conn.id}
                        onSelect={handleSetActiveConnection}
                        onDelete={deleteConnection}
                        />
                    ))}
                    </SidebarMenu>
                </ScrollArea>
                </SidebarContent>
            </Sidebar>
            
            {connections.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center">
                    <div className="max-w-md">
                        <Rocket className="mx-auto h-16 w-16 text-primary/80 mb-6" strokeWidth={1.5} />
                        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao API Insights</h1>
                        <p className="mt-4 text-lg text-muted-foreground">Para começar, crie sua primeira fonte de dados. Conecte-se a qualquer API e comece a explorar.</p>
                        <div className="mt-8">
                            <ConnectionDialog onSave={addConnection}>
                                <Button variant="primary" size="lg">
                                    <Plus className="mr-2 -ml-1"/>
                                    Criar Nova Fonte de Dados
                                </Button>
                            </ConnectionDialog>
                        </div>
                    </div>
                </div>
                ) : (
                <PageContainer>
                <Card className="bg-card/80 backdrop-blur-xl">
                    <CardContent className="p-4">
                        <QueryBuilderForm form={queryForm} onSubmit={handleExecuteQuery} isPending={isPending} activeConnection={activeConnection} />
                    </CardContent>
                </Card>

                <Card className="flex-1 flex flex-col overflow-hidden bg-card/80 backdrop-blur-xl">
                    <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl">Resultados</CardTitle>
                        <CardDescription>Dados retornados da sua consulta.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <ColumnManagerDrawer 
                        columns={columns} 
                        setColumns={setColumns} 
                        onOrderChange={updateColumnOrder}
                        />
                        <ExportDropdown onExport={handleExport} isPending={isPending} />
                    </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-0">
                    {isPending && !apiResponse && <LoadingState />}
                    {apiResponse?.error && <ErrorState message={apiResponse.error} />}
                    {!isPending && !apiResponse && <InitialState />}
                    {apiResponse?.data && apiResponse.data.length > 0 && (
                        <DataTable data={apiResponse.data} columns={visibleColumns} />
                    )}
                    {apiResponse?.data && apiResponse.data.length === 0 && <p className="p-6">A consulta foi bem-sucedida, mas não retornou dados.</p>}
                    </CardContent>
                </Card>
                </PageContainer>
            )}
        </div>
    </SidebarProvider>
  );
}

// Types
type Column = {
  key: string;
  friendlyName: string;
  visible: boolean;
  order: number;
};

// Sub-components

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
          <Button type="submit" variant="primary" disabled={isPending || !activeConnection} className="h-10">
            {isPending ? <Sparkles className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Executar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
           <div>
              <h4 className="font-medium mb-2 text-foreground">Parâmetros</h4>
              <ScrollArea className="h-32 pr-4 -mr-4">
                {params.map((field, index) => (
                  <div key={field.id} className="flex gap-2 mb-2">
                    <Input {...form.register(`params.${index}.key`)} placeholder="key" className="h-8" />
                    <Input {...form.register(`params.${index}.value`)} placeholder="value" className="h-8" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeParam(index)}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
              </ScrollArea>
              <Button type="button" variant="secondary" size="sm" onClick={() => appendParam({ key: "", value: "" })} className="mt-2 w-full">Adicionar Parâmetro</Button>
           </div>
           <div>
              <h4 className="font-medium mb-2 text-foreground">Headers</h4>
              <ScrollArea className="h-32 pr-4 -mr-4">
                {headers.map((field, index) => (
                   <div key={field.id} className="flex gap-2 mb-2">
                    <Input {...form.register(`headers.${index}.key`)} placeholder="key" className="h-8"/>
                    <Input {...form.register(`headers.${index}.value`)} placeholder="value" className="h-8"/>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeHeader(index)}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
              </ScrollArea>
              <Button type="button" variant="secondary" size="sm" onClick={() => appendHeader({ key: "", value: "" })} className="mt-2 w-full">Adicionar Header</Button>
           </div>
           <div>
             <h4 className="font-medium mb-2 text-foreground">Body (JSON)</h4>
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
  const headers = useMemo(() => columns.map(col => <TableHead key={col.key} className="uppercase tracking-wider font-medium text-muted-foreground">{col.friendlyName}</TableHead>), [columns]);
  
  const rows = useMemo(() => data.map((row, rowIndex) => (
    <TableRow key={rowIndex} className="border-white/10 odd:bg-white/[0.02]">
      {columns.map(col => (
        <TableCell key={`${rowIndex}-${col.key}`} className="font-code text-sm max-w-xs truncate py-3">
          {typeof row[col.key] === 'object' && row[col.key] !== null ? JSON.stringify(row[col.key]) : String(row[col.key] ?? '')}
        </TableCell>
      ))}
    </TableRow>
  )), [data, columns]);

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader><TableRow className="border-b border-white/10 hover:bg-transparent">{headers}</TableRow></TableHeader>
        <TableBody>{rows}</TableBody>
      </Table>
    </ScrollArea>
  );
}

function ColumnManagerDrawer({ columns, setColumns, onOrderChange }: { columns: Column[], setColumns: (cols: Column[]) => void, onOrderChange: (index: number, direction: 'up' | 'down') => void }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleVisibilityChange = (key: string, visible: boolean) => {
    setColumns(columns.map(c => c.key === key ? { ...c, visible } : c));
  };

  const handleNameChange = (key: string, friendlyName: string) => {
    setColumns(columns.map(c => c.key === key ? { ...c, friendlyName } : c));
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary"><Columns className="mr-2 size-4"/> Gerenciar Colunas</Button>
      </SheetTrigger>
      <SheetContent>
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
        <Button variant="secondary"><FileDown className="mr-2 size-4" /> Exportar</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onExport("json")} disabled={isPending}><FileJson className="mr-2 size-4" /> JSON</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("csv")} disabled={isPending}><SheetIcon className="mr-2 size-4" /> CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("pdf")} disabled={true}><FileText className="mr-2 size-4" /> PDF (em breve)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center h-full text-center">
    <div className="relative w-16 h-16">
       <div className="absolute inset-0 border-2 border-white/10 rounded-full"></div>
       <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin"></div>
    </div>
    <p className="mt-4 text-md font-medium text-foreground">Buscando dados...</p>
    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
      <Sparkles className="size-4 text-primary/80" /> IA analisando a estrutura...
    </p>
  </div>
);

const ErrorState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center h-full p-4">
    <Alert variant="destructive" className="max-w-md">
      <AlertCircle className="size-4" />
      <AlertTitle>Ocorreu um Erro</AlertTitle>
      <AlertDescription className="font-code text-sm">{message}</AlertDescription>
    </Alert>
  </div>
);

const InitialState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
       <div className="mb-4 text-primary/50">
          <Database className="size-16" strokeWidth={1.5}/>
       </div>
      <h3 className="text-2xl font-bold tracking-tight">Pronto para a Ação</h3>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Selecione uma fonte de dados e execute uma consulta. Os resultados aparecerão aqui.
      </p>
    </div>
  );

    