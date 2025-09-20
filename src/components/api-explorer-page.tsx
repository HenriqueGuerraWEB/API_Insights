

"use client";

import { useState, useMemo, useTransition, useCallback, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  Trash2,
  Copy,
  Download,
  Loader2
} from "lucide-react";
import { ConnectionDialogContent } from "@/components/connection-dialog";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const PageContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="flex-1 flex flex-col gap-4 p-4 md:p-6">
    {children}
  </div>
);

// Main Component
export default function ApiExplorerPage() {
  const { connections, addConnection, deleteConnection, activeConnection, setActiveConnectionId, isLoading: connectionsLoading } = useConnections();
  
  const [apiResponse, setApiResponse] = useState<FetchApiDataOutput | null>(null);
  const [displayData, setDisplayData] = useState<any[]>([]);

  const [columns, setColumns] = useState<Column[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isNewConnectionDialogOpen, setIsNewConnectionDialogOpen] = useState(false);
  const [isJsonViewerOpen, setIsJsonViewerOpen] = useState(false);
  const [jsonViewerData, setJsonViewerData] = useState<any>(null);


  const form = useForm<{ method: string, url: string, body: string, params: {key:string, value:string}[], headers: {key:string, value:string}[] }>({
    defaultValues: { method: "GET", url: "", body: "", params: [], headers: [] },
  });
  
  const { control, setValue, watch } = form;
  
  useEffect(() => {
    if (activeConnection) {
        setValue('url', activeConnection.baseUrl);
    } else {
        setValue('url', '');
    }
    setApiResponse(null);
    setDisplayData([]);
    setColumns([]);
  }, [activeConnection, setValue]);


  const handleSetActiveConnection = useCallback((id: string | null) => {
      setActiveConnectionId(id);
  }, [setActiveConnectionId]);

  
  const sortedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns]);
  const visibleColumns = useMemo(() => sortedColumns.filter(c => c.visible), [sortedColumns]);

  const handleExecuteQuery = () => {
    form.handleSubmit(async (values) => {
      startTransition(async () => {
        setApiResponse(null);
        
        const result = await fetchApiData({
          connectionId: activeConnection?.id || null,
          url: values.url,
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
      setDisplayData([]);
    } else if (result.data) {
        if(result.isDiscovery) {
            setDisplayData([]);
            setColumns([]);
            return;
        }

        let dataArray = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : []);
        
        if (dataArray.length === 1 && dataArray[0].data && Array.isArray(dataArray[0].data)) {
            dataArray = dataArray[0].data;
        }

        setDisplayData(dataArray);
        
        if (dataArray.length > 0) {
            const keys = Array.from(new Set(dataArray.flatMap(item => typeof item === 'object' && item !== null ? Object.keys(item) : [])));

            const newColumns = keys.map((key, index) => ({
                key,
                friendlyName: result.suggestedNames[key] || key,
                visible: true,
                order: index,
            }));
            setColumns(newColumns);
        } else {
            setColumns([]);
        }
    }
  }

  const handleExport = async (format: "json" | "csv" | "pdf") => {
    if (displayData.length === 0 || visibleColumns.length === 0) {
      toast({ variant: "destructive", title: "Não há dados para exportar." });
      return;
    }
    
    const exportCols = visibleColumns.map(c => ({ key: c.key, name: c.friendlyName }));
    const processedData = displayData.map(row => {
        const newRow: Record<string, any> = {};
        for (const col of exportCols) {
            if (row.hasOwnProperty(col.key)) {
                newRow[col.name] = row[col.key];
            }
        }
        return newRow;
    });

    if (format === 'json') {
        setJsonViewerData({
            title: "Exportar JSON",
            data: processedData,
            showDownload: true,
        });
        setIsJsonViewerOpen(true);
        return;
    }

    startTransition(async () => {
      const result = await exportData({ data: displayData, columns: exportCols, format });

      if (result.error) {
        toast({ variant: "destructive", title: "Erro na Exportação", description: result.error });
      } else {
        triggerDownload(result.content, result.fileName, result.mimeType);
        toast({ title: "Exportação Concluída", description: `${result.fileName} foi baixado.` });
      }
    });
  };

  const triggerDownload = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
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
  
  const handleExploreEndpoint = (endpointPath: string) => {
    if (!activeConnection) return;
    
    const fullUrl = activeConnection.baseUrl.endsWith('/') || endpointPath.startsWith('/')
        ? `${activeConnection.baseUrl}${endpointPath}`
        : `${activeConnection.baseUrl}/${endpointPath}`;

    setValue('url', fullUrl);
    
    form.handleSubmit(async () => {
        startTransition(async () => {
            setApiResponse(null);
            const result = await fetchApiData({
                connectionId: activeConnection.id,
                url: fullUrl,
                method: 'GET',
                body: '',
                params: [],
                headers: [],
            });
            handleApiResponse(result);
        });
    })();
  };
  
  const handleViewJson = (rowData: any) => {
    setJsonViewerData({
        title: "Visualizador JSON",
        data: rowData,
        showDownload: false,
    });
    setIsJsonViewerOpen(true);
  };


  const hasConnections = connections.length > 0;
  const showWelcomeScreen = !connectionsLoading && !hasConnections;
  const isDiscoveryMode = !!apiResponse?.isDiscovery;
  const showDataTable = displayData.length > 0 && !isDiscoveryMode;

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
        
        <Dialog open={isJsonViewerOpen} onOpenChange={setIsJsonViewerOpen}>
          <DialogContent className="max-w-3xl">
              <JsonViewerDialog 
                title={jsonViewerData?.title}
                data={jsonViewerData?.data} 
                showDownload={jsonViewerData?.showDownload}
                onDownload={(content, fileName, mimeType) => {
                    triggerDownload(content, fileName, mimeType);
                    toast({ title: "Download Iniciado", description: `${fileName} foi baixado.` });
                }}
                onClose={() => setIsJsonViewerOpen(false)}
              />
          </DialogContent>
        </Dialog>

        {connectionsLoading ? (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : showWelcomeScreen ? (
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
                    <QueryBuilderForm form={form} onSubmit={handleExecuteQuery} isPending={isPending} />
                </CardContent>
            </Card>

            <Card className="flex-1 flex flex-col overflow-hidden bg-card/80 backdrop-blur-xl">
                <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-2xl">
                       Resultados
                    </CardTitle>
                    <CardDescription>
                        {isDiscoveryMode 
                            ? `Endpoints encontrados na sua API. Clique em "Explorar" para consultá-los.`
                            : displayData.length > 0
                              ? 'Dados retornados da sua consulta.'
                              : 'Execute uma consulta para ver os resultados.'
                        }
                    </CardDescription>
                </div>
                {showDataTable && (
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
                
                {!isPending && !apiResponse?.error && (
                    <>
                        {isDiscoveryMode && activeConnection && (
                             <DiscoveryView 
                                data={apiResponse.data} 
                                onExplore={handleExploreEndpoint}
                              />
                        )}
                        {showDataTable && (
                            <DataTable data={displayData} columns={visibleColumns} onRowDelete={handleRowDelete} onViewJson={handleViewJson}/>
                        )}
                        {(!apiResponse || (!apiResponse.data && !apiResponse.error)) && !isPending && <InitialState />}
                        
                        {!isPending && apiResponse && !apiResponse.error && !isDiscoveryMode && displayData.length === 0 && <EmptyState />}
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

function QueryBuilderForm({ form, onSubmit, isPending }: { form: any, onSubmit: () => void, isPending: boolean }) {
  const { fields: params, append: appendParam, remove: removeParam } = useFieldArray({ control: form.control, name: "params" });
  const { fields: headers, append: appendHeader, remove: removeHeader } = useFieldArray({ control: form.control, name: "headers" });
  
  return (
    <Form {...form}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <div className="flex gap-4 items-end">
          <FormField name="method" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Método</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem><SelectItem value="PUT">PUT</SelectItem><SelectItem value="DELETE">DELETE</SelectItem></SelectContent></Select></FormItem>
          )} />
          <FormField name="url" control={form.control} render={({ field }) => (
            <FormItem className="flex-1">
               <FormLabel>URL</FormLabel>
               <FormControl>
                  <Input {...field} placeholder="https://seu-api.com/recurso" className="font-code" />
                </FormControl>
            </FormItem>
          )} />
          <Button type="submit" variant="primary" disabled={isPending} className="h-10">
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
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeParam(index)}><Plus className="size-4 rotate-45" /></Button>
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
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeHeader(index)}><Plus className="size-4 rotate-45" /></Button>
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

function DataTable({ data, columns, onRowDelete, onViewJson }: { data: any[]; columns: Column[]; onRowDelete: (rowIndex: number) => void; onViewJson: (rowData: any) => void; }) {
  const headers = useMemo(() => columns.map(col => <TableHead key={col.key} className="uppercase tracking-wider font-medium text-muted-foreground">{col.friendlyName}</TableHead>), [columns]);
  
  const rows = useMemo(() => data.map((row, rowIndex) => (
    <TableRow key={row.id || rowIndex} className="border-white/10 odd:bg-white/[0.02] group">
      {columns.map(col => (
        <TableCell key={`${rowIndex}-${col.key}`} className="font-code text-sm max-w-xs truncate py-3">
          {typeof row[col.key] === 'object' && row[col.key] !== null ? JSON.stringify(row[col.key]) : String(row[col.key] ?? '')}
        </TableCell>
      ))}
       <TableCell className="text-right w-24">
          <div className="flex justify-end items-center opacity-0 group-hover:opacity-100 gap-1">
             <Button variant="ghost" size="icon" className="size-8" onClick={() => onViewJson(row)}>
                <Eye className="size-4 text-muted-foreground hover:text-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => onRowDelete(rowIndex)}>
                <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
      </TableCell>
    </TableRow>
  )), [data, columns, onRowDelete, onViewJson]);

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
        Selecione uma fonte de dados e execute uma consulta para ver os resultados.
      </p>
    </div>
);

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
       <div className="mb-4 text-muted-foreground/50">
          <Search className="size-16" strokeWidth={1.5}/>
       </div>
      <h3 className="text-2xl font-bold tracking-tight">Nenhum Resultado</h3>
      <p className="mt-2 max-w-sm text-muted-foreground">
        A sua consulta foi executada com sucesso, mas não retornou nenhum dado.
      </p>
    </div>
);


function DiscoveryView({ data, onExplore }: { data: any, onExplore: (path: string) => void }) {
    const schema = Array.isArray(data) ? data[0] : data;
    const routes = schema?.routes ? Object.entries(schema.routes) : [];
  
    return (
      <ScrollArea className="h-full">
        <div className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {routes.length > 0 ? routes.map(([path, routeInfo]: [string, any]) => {
             return (
                <Card key={path} className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-lg font-code break-all">{path}</CardTitle>
                     <div className="flex gap-2 pt-2">
                        {Array.isArray(routeInfo.methods) && routeInfo.methods.map((method: string, index: number) => (
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
            );
          }) : <p>A API não retornou um schema de rotas reconhecível.</p>}
        </div>
      </ScrollArea>
    );
}

function JsonViewerDialog({ title, data, showDownload, onDownload, onClose }: { title?: string, data: any, showDownload?: boolean, onDownload?: (content: string, fileName: string, mimeType: string) => void, onClose: () => void }) {
    const { toast } = useToast();
    const jsonString = useMemo(() => JSON.stringify(data, null, 2), [data]);

    const handleCopy = () => {
        navigator.clipboard.writeText(jsonString).then(() => {
            toast({ title: "Copiado!", description: "Os dados JSON foram copiados para a área de transferência." });
        }, (err) => {
            toast({ variant: "destructive", title: "Falha ao copiar", description: "Não foi possível copiar os dados." });
            console.error('Could not copy text: ', err);
        });
    };

    const handleDownload = () => {
        if (onDownload) {
            const fileName = `export-${Date.now()}.json`;
            onDownload(jsonString, fileName, 'application/json');
        }
    };

    if (!data) return null;

    return (
        <>
            <DialogHeader>
                <DialogTitle>{title || 'Visualizador JSON'}</DialogTitle>
            </DialogHeader>
            <div className="relative">
                <ScrollArea className="h-[60vh] w-full rounded-md border bg-muted/30 p-4">
                    <pre><code className="font-code text-sm">{jsonString}</code></pre>
                </ScrollArea>
            </div>
            <DialogFooter className="sm:justify-between">
                <Button onClick={onClose} variant="ghost">
                    Fechar
                </Button>
                <div className="flex gap-2">
                    <Button onClick={handleCopy} variant="secondary">
                        <Copy className="mr-2 size-4" />
                        Copiar
                    </Button>
                    {showDownload && (
                         <Button onClick={handleDownload} variant="primary">
                            <Download className="mr-2 size-4" />
                            Baixar
                        </Button>
                    )}
                </div>
            </DialogFooter>
        </>
    );
}
