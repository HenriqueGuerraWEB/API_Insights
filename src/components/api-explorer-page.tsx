

"use client";

import { useState, useMemo, useTransition, useCallback, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { useConnections, type Connection } from "@/hooks/use-connections";
import { fetchApiData, exportData, FetchApiDataOutput } from "@/app/actions";
import {
  Plus,
  Database,
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
  Rocket,
  Search,
  Trash2
} from "lucide-react";
import { ConnectionDialogContent } from "@/components/connection-dialog";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "./ui/badge";

const PageContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="flex-1 flex flex-col gap-4 p-4">
    {children}
  </div>
);

// Main Component
export default function ApiExplorerPage() {
  const { connections, addConnection, deleteConnection, activeConnection, setActiveConnectionId } = useConnections();
  
  const [viewMode, setViewMode] = useState<'welcome' | 'discovery' | 'data-explorer'>('welcome');
  const [apiResponse, setApiResponse] = useState<FetchApiDataOutput | null>(null);
  const [displayData, setDisplayData] = useState<any[]>([]);
  const [apiNamespace, setApiNamespace] = useState<string | null>(null);


  const [columns, setColumns] = useState<Column[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isNewConnectionDialogOpen, setIsNewConnectionDialogOpen] = useState(false);

  const queryForm = useForm<{ method: string, path: string, body: string, params: {key:string, value:string}[], headers: {key:string, value:string}[] }>({
    defaultValues: { method: "GET", path: "/", body: "", params: [], headers: [] },
  });
  
 const handleSetActiveConnection = useCallback((id: string | null) => {
    setActiveConnectionId(id);
    const newActiveConnection = connections.find(c => c.id === id);
    if (newActiveConnection) {
        // When a connection is selected, fetch its schema by default
        const initialPath = newActiveConnection.apiType === 'wordpress' ? '/wp-json' : '/';
        queryForm.setValue('path', initialPath);
        handleExecuteQuery(newActiveConnection, initialPath);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveConnectionId, queryForm, connections]);


  useEffect(() => {
    if (activeConnection) {
        setViewMode('data-explorer'); 
    } else if (connections.length > 0 && !activeConnection) {
      // If there are connections but none is active, activate the first one.
      handleSetActiveConnection(connections[0].id);
    } else { // No connections
      setViewMode('welcome');
      setApiResponse(null);
      setDisplayData([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnection, connections, setActiveConnectionId]);


  const sortedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns]);
  const visibleColumns = useMemo(() => sortedColumns.filter(c => c.visible), [sortedColumns]);

  const handleExecuteQuery = (connectionOverride?: Connection | null, pathOverride?: string) => {
    queryForm.handleSubmit(async (values) => {
      const currentConnection = connectionOverride || activeConnection;

      if (!currentConnection) {
        toast({ variant: "destructive", title: "Nenhuma conexão selecionada." });
        return;
      }

      startTransition(async () => {
        setApiResponse(null);
        
        const result = await fetchApiData({
          connection: currentConnection,
          path: pathOverride ?? values.path,
          method: values.method,
          body: values.body,
          params: values.params,
          headers: values.headers,
        });
        
        handleApiResponse(result);
      });
    })();
  }
  

  const handleApiResponse = (result: FetchApiDataOutput) => {
    setApiResponse(result);

    if (result.error) {
      setViewMode('data-explorer'); // Stay in data explorer to show error
      setDisplayData([]);
      setApiNamespace(null);
    } else if (result.data) {
        const firstItem = Array.isArray(result.data) ? result.data[0] : result.data;
        // A response is considered a schema/discovery response if it contains a `routes` object.
        const isSchema = firstItem && typeof firstItem === 'object' && 'routes' in firstItem && typeof firstItem.routes === 'object';
        
        if (isSchema) {
            setViewMode('discovery');
            setDisplayData(result.data); 
            setApiNamespace(result.namespace);
        } else {
            setViewMode('data-explorer');
            setDisplayData(result.data);
            setApiNamespace(null); 
            const newColumns = Object.keys(result.suggestedNames).map((key, index) => ({
              key,
              friendlyName: result.suggestedNames[key] || key,
              visible: true,
              order: index,
            }));
            setColumns(newColumns);
        }
    }
  }


  const handleExport = async (format: "json" | "csv" | "pdf") => {
    if (displayData.length === 0 || visibleColumns.length === 0) {
      toast({ variant: "destructive", title: "Não há dados para exportar." });
      return;
    }

    startTransition(async () => {
      const exportCols = visibleColumns.map(c => ({ key: c.key, name: c.friendlyName }));
      const result = await exportData({ data: displayData, columns: exportCols, format });

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
  
   const handleAddNewConnection = useCallback((newConnection: Omit<Connection, "id">) => {
    addConnection(newConnection);
    setIsNewConnectionDialogOpen(false);
  }, [addConnection]);

  const updateColumnOrder = (index: number, direction: 'up' | 'down') => {
    const newColumns = [...columns];
    const item = newColumns[index];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (swapIndex < 0 || swapIndex >= newColumns.length) return;

    const [swappedItem] = newColumns.splice(swapIndex, 1, item);
    newColumns.splice(index, 1, swappedItem);
    
    setColumns(newColumns.map((col, idx) => ({ ...col, order: idx })));
  };

  const handleRowDelete = (rowIndex: number) => {
    setDisplayData(prevData => prevData.filter((_, index) => index !== rowIndex));
  };
  
  const handleExploreEndpoint = (path: string) => {
      queryForm.setValue('path', path);
      handleExecuteQuery(null, path);
  };
  
  
  const getDisplayBaseUrl = () => {
      if (!activeConnection) return 'Selecione uma conexão';
      
      let displayUrl = activeConnection.baseUrl;
      
      return displayUrl.endsWith('/') ? displayUrl.slice(0, -1) : displayUrl;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar 
          connections={connections} 
          activeConnectionId={activeConnection?.id || null}
          onAddConnection={() => setIsNewConnectionDialogOpen(true)}
          onDeleteConnection={deleteConnection}
          onSelectConnection={handleSetActiveConnection}
        />
        
        <Dialog open={isNewConnectionDialogOpen} onOpenChange={setIsNewConnectionDialogOpen}>
          <DialogContent>
              <ConnectionDialogContent onSave={handleAddNewConnection} onCancel={() => setIsNewConnectionDialogOpen(false)} />
          </DialogContent>
        </Dialog>

        {viewMode === 'welcome' && connections.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-4">
              <div className="max-w-md">
                  <Rocket className="mx-auto h-16 w-16 text-primary/80 mb-6" strokeWidth={1.5} />
                  <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao API Insights</h1>
                  <p className="mt-4 text-lg text-muted-foreground">Para começar, crie sua primeira fonte de dados. Conecte-se a qualquer API e comece a explorar.</p>
                  <div className="mt-8">
                      <Button variant="primary" size="lg" onClick={() => setIsNewConnectionDialogOpen(true)}>
                          <Plus className="mr-2 -ml-1"/>
                          Criar Nova Fonte de Dados
                      </Button>
                  </div>
              </div>
          </div>
        ) : (
          <PageContainer>
            <Card className="bg-card/80 backdrop-blur-xl">
                <CardContent className="p-4">
                    <QueryBuilderForm form={queryForm} onSubmit={() => handleExecuteQuery()} isPending={isPending} activeConnection={activeConnection} />
                </CardContent>
            </Card>

            <Card className="flex-1 flex flex-col overflow-hidden bg-card/80 backdrop-blur-xl">
                <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-2xl">
                        {viewMode === 'discovery' ? 'Endpoints Disponíveis' : 'Resultados'}
                    </CardTitle>
                    <CardDescription>
                        {viewMode === 'discovery' && activeConnection?.baseUrl ? `Endpoints encontrados em ${activeConnection.baseUrl}` : 'Dados retornados da sua consulta.'}
                    </CardDescription>
                </div>
                {viewMode === 'data-explorer' && (
                    <div className="flex items-center gap-2">
                        <ColumnManagerDrawer 
                        columns={columns} 
                        setColumns={setColumns} 
                        onOrderChange={updateColumnOrder}
                        />
                        <ExportDropdown onExport={handleExport} isPending={isPending} />
                    </div>
                )}
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-0">
                {isPending && <LoadingState />}
                {!isPending && apiResponse?.error && <ErrorState message={apiResponse.error} />}
                
                {viewMode === 'discovery' && apiResponse?.data && !isPending && (
                    <DiscoveryView data={apiResponse.data} onExplore={handleExploreEndpoint} />
                )}

                {viewMode === 'data-explorer' && displayData.length > 0 && !isPending && (
                    <DataTable data={displayData} columns={visibleColumns} onRowDelete={handleRowDelete}/>
                )}

                {!isPending && !apiResponse?.error && (
                  <>
                    {viewMode !== 'discovery' && displayData.length === 0 && <InitialState />}
                  </>
                )}
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

function QueryBuilderForm({ form, onSubmit, isPending, activeConnection }: { form: any, onSubmit: () => void, isPending: boolean, activeConnection: Connection | undefined | null }) {
  const { fields: params, append: appendParam, remove: removeParam } = useFieldArray({ control: form.control, name: "params" });
  const { fields: headers, append: appendHeader, remove: removeHeader } = useFieldArray({ control: form.control, name: "headers" });
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex gap-4 items-end">
          <FormField name="method" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Método</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem><SelectItem value="PUT">PUT</SelectItem><SelectItem value="DELETE">DELETE</SelectItem></SelectContent></Select></FormItem>
          )} />
          <FormField name="path" control={form.control} render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Caminho do Endpoint</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-code">
                    {activeConnection?.baseUrl}{activeConnection?.baseUrl.endsWith('/') ? '' : '/'}
                  </span>
                  <Input 
                    {...field} 
                    placeholder="caminho/do/endpoint" 
                    className="font-code"
                    style={{ paddingLeft: `calc(${activeConnection?.baseUrl.length || 0}ch + 2rem)`}}
                  />
                </div>
              </FormControl>
            </FormItem>
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
                    <Input {...form.register(`params.${index}.key`)} placeholder="key" className="h-8 font-code" />
                    <Input {...form.register(`params.${index}.value`)} placeholder="value" className="h-8 font-code" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeParam(index)}><Plus className="size-4 rotate-45" /></Button>
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
                    <Input {...form.register(`headers.${index}.key`)} placeholder="key" className="h-8 font-code"/>
                    <Input {...form.register(`headers.${index}.value`)} placeholder="value" className="h-8 font-code"/>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeHeader(index)}><Plus className="size-4 rotate-45" /></Button>
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

function DataTable({ data, columns, onRowDelete }: { data: any[]; columns: Column[]; onRowDelete: (rowIndex: number) => void }) {
  const headers = useMemo(() => columns.map(col => <TableHead key={col.key} className="uppercase tracking-wider font-medium text-muted-foreground">{col.friendlyName}</TableHead>), [columns]);
  
  const rows = useMemo(() => data.map((row, rowIndex) => (
    <TableRow key={row.id || rowIndex} className="border-white/10 odd:bg-white/[0.02] group">
      {columns.map(col => (
        <TableCell key={`${rowIndex}-${col.key}`} className="font-code text-sm max-w-xs truncate py-3">
          {typeof row[col.key] === 'object' && row[col.key] !== null ? JSON.stringify(row[col.key]) : String(row[col.key] ?? '')}
        </TableCell>
      ))}
       <TableCell className="text-right w-10">
          <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100" onClick={() => onRowDelete(rowIndex)}>
              <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
          </Button>
      </TableCell>
    </TableRow>
  )), [data, columns, onRowDelete]);

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader><TableRow className="border-b border-white/10 hover:bg-transparent">{headers}<TableHead /></TableRow></TableHeader>
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
    <Alert variant="destructive" className="max-w-xl">
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


function DiscoveryView({ data, onExplore }: { data: any, onExplore: (path: string) => void }) {
    const schema = Array.isArray(data) ? data[0] : data;
    const routes = schema?.routes ? Object.entries(schema.routes) : [];
  
    return (
      <ScrollArea className="h-full">
        <div className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {routes.length > 0 ? routes.map(([path, routeInfo]: [string, any]) => (
            <Card key={path} className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg font-code break-all">{path}</CardTitle>
                <div className="flex gap-2 pt-2">
                  {routeInfo.methods.map((method: string, index: number) => (
                     <Badge key={`${path}-${method}-${index}`} variant={method === 'GET' ? 'secondary' : 'outline'}>{method}</Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <Button onClick={() => onExplore(path)}>
                  <Search className="mr-2 size-4" />
                  Explorar Endpoint
                </Button>
              </CardContent>
            </Card>
          )) : <p>A API não retornou um schema de rotas reconhecível.</p>}
        </div>
      </ScrollArea>
    );
  }

    
