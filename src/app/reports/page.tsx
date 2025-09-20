
"use client";

import { useState, useTransition } from "react";
import Link from 'next/link';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, AlertCircle, Loader2, BarChart, ShoppingBag, DollarSign, ListOrdered, CheckIcon, Rocket, LayoutDashboard } from "lucide-react";
import { useConnections } from "@/hooks/use-connections";
import { cn } from "@/lib/utils";
import { calculateFinancialMetrics } from "@/lib/report-calculator";
import type { FinancialReport, FinancialReportInput } from "@/lib/report-calculator";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";


const reportFormSchema = z.object({
  dateRange: z.object({
    from: z.date({ required_error: "A data de início é obrigatória." }),
    to: z.date({ required_error: "A data de fim é obrigatória." }),
  }),
  statuses: z.array(z.string()).min(1, "Selecione pelo menos um status."),
  connectionId: z.string().min(1, "Selecione uma fonte de dados."),
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

const ALL_STATUSES = [
    { id: 'pending', name: 'Pendente' },
    { id: 'processing', name: 'Processando' },
    { id: 'on-hold', name: 'Aguardando' },
    { id: 'completed', name: 'Concluído' },
    { id: 'cancelled', name: 'Cancelado' },
    { id: 'refunded', name: 'Reembolsado' },
    { id: 'failed', name: 'Falhou' }
];

export default function ReportsPage() {
  const { connections } = useConnections();
   const defaultConnection = connections.find(c => c.apiType === 'WordPress') || connections[0];
  const [isPending, startTransition] = useTransition();
  const [reportData, setReportData] = useState<FinancialReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      dateRange: {
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        to: new Date(),
      },
      statuses: ["completed"],
      connectionId: defaultConnection?.id || "",
    },
  });

  const onSubmit = (values: ReportFormValues) => {
    startTransition(async () => {
      setError(null);
      setReportData(null);

      const params: FinancialReportInput = {
        startDate: format(values.dateRange.from, "yyyy-MM-dd"),
        endDate: format(values.dateRange.to, "yyyy-MM-dd"),
        status: values.statuses.join(','),
        connectionId: values.connectionId
      };
      
      try {
        const queryParams = new URLSearchParams({
            startDate: params.startDate,
            endDate: params.endDate,
            status: params.status,
            connectionId: params.connectionId,
        });

        const response = await fetch(`/api/reports/financial?${queryParams.toString()}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Falha ao buscar os dados dos pedidos.");
        }

        const orders = await response.json();
        const metrics = calculateFinancialMetrics(orders);
        setReportData(metrics);

      } catch (e: any) {
        setError(e.message || "Ocorreu um erro desconhecido.");
      }
    });
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background text-foreground">
          <TooltipProvider>
              <Sidebar variant="sidebar" collapsible="icon" className="hidden md:flex">
                  <SidebarHeader>
                      <Tooltip>
                          <TooltipTrigger asChild>
                               <Link href="/">
                                  <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg border border-primary/20 cursor-pointer">
                                      <Rocket className="size-5 text-primary" />
                                  </div>
                              </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">App Home</TooltipContent>
                      </Tooltip>
                  </SidebarHeader>
                  <SidebarContent>
                      <SidebarMenu>
                           <SidebarMenuItem>
                              <Link href="/">
                                  <SidebarMenuButton tooltip="API Explorer" className="justify-center">
                                      <LayoutDashboard />
                                  </SidebarMenuButton>
                              </Link>
                          </SidebarMenuItem>
                      </SidebarMenu>
                  </SidebarContent>
              </Sidebar>
          </TooltipProvider>

          <div className="flex-1 flex flex-col gap-4 p-4 md:p-6 overflow-auto">
          <Card className="bg-card/80 backdrop-blur-xl">
              <CardHeader>
              <CardTitle>Relatório Financeiro</CardTitle>
              <CardDescription>
                  Selecione o período, os status dos pedidos e a fonte de dados para gerar seu relatório.
              </CardDescription>
              </CardHeader>
              <CardContent>
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      <FormField
                      control={form.control}
                      name="dateRange"
                      render={({ field }) => (
                          <FormItem className="flex flex-col">
                          <FormLabel>Período</FormLabel>
                          <Popover>
                              <PopoverTrigger asChild>
                              <Button
                                  variant={"outline"}
                                  className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value.from && "text-muted-foreground"
                                  )}
                              >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value.from ? (
                                  field.value.to ? (
                                      <>
                                      {format(field.value.from, "LLL dd, y", { locale: ptBR })} -{" "}
                                      {format(field.value.to, "LLL dd, y", { locale: ptBR })}
                                      </>
                                  ) : (
                                      format(field.value.from, "LLL dd, y", { locale: ptBR })
                                  )
                                  ) : (
                                  <span>Selecione um período</span>
                                  )}
                              </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                  mode="range"
                                  selected={{ from: field.value.from, to: field.value.to }}
                                  onSelect={(range) => field.onChange(range)}
                                  numberOfMonths={2}
                                  locale={ptBR}
                              />
                              </PopoverContent>
                          </Popover>
                          </FormItem>
                      )}
                      />
                      <FormField
                          control={form.control}
                          name="statuses"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Status dos Pedidos</FormLabel>
                              <Popover>
                                  <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start font-normal">
                                      {field.value.length > 0
                                      ? `${field.value.length} status selecionados`
                                      : "Selecione os status"}
                                  </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-0">
                                      <Command>
                                          <CommandInput placeholder="Buscar status..." />
                                          <CommandList>
                                              <CommandEmpty>Nenhum status encontrado.</CommandEmpty>
                                              <CommandGroup>
                                                  {ALL_STATUSES.map((status) => (
                                                      <CommandItem
                                                          key={status.id}
                                                          onSelect={() => {
                                                              const currentValues = field.value || [];
                                                              const newValue = currentValues.includes(status.id)
                                                                  ? currentValues.filter((s) => s !== status.id)
                                                                  : [...currentValues, status.id];
                                                              field.onChange(newValue);
                                                          }}
                                                      >
                                                          <div className={cn(
                                                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                              field.value.includes(status.id)
                                                                  ? "bg-primary text-primary-foreground"
                                                                  : "opacity-50 [&_svg]:invisible"
                                                          )}>
                                                          <CheckIcon className={cn("h-4 w-4")} />
                                                          </div>
                                                          <span>{status.name}</span>
                                                      </CommandItem>
                                                  ))}
                                              </CommandGroup>
                                          </CommandList>
                                      </Command>
                                  </PopoverContent>
                              </Popover>
                              </FormItem>
                          )}
                          />
                      <FormField
                      control={form.control}
                      name="connectionId"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Fonte de Dados</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Selecione uma conexão" />
                              </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                              {connections.filter(c => c.apiType === 'WordPress').map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                  </SelectItem>
                              ))}
                              </SelectContent>
                          </Select>
                          </FormItem>
                      )}
                      />
                      <div className="flex items-end">
                          <Button type="submit" disabled={isPending} className="w-full" variant="primary">
                              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Gerar Relatório
                          </Button>
                      </div>
                  </div>
                  </form>
              </Form>
              </CardContent>
          </Card>
          
          <div className="flex-1 flex flex-col">
              {isPending && <LoadingState />}
              {error && <ErrorState message={error} />}
              {reportData && <ReportResults data={reportData} />}
              {!isPending && !error && !reportData && <InitialState />}
          </div>
          </div>
      </div>
    </SidebarProvider>
  );
}

const LoadingState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium">Gerando seu relatório...</p>
        <p className="text-sm">Buscando e processando os dados. Isso pode levar alguns instantes.</p>
    </div>
);
  

const ErrorState = ({ message }: { message: string }) => (
    <div className="flex items-center justify-center h-full p-4">
      <Alert variant="destructive" className="max-w-xl">
        <AlertCircle className="size-4" />
        <AlertTitle>Ocorreu um Erro ao Gerar o Relatório</AlertTitle>
        <AlertDescription className="font-code text-sm">{message}</AlertDescription>
      </Alert>
    </div>
);

const InitialState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground bg-card/50 rounded-lg border border-dashed">
       <div className="mb-4 text-primary/50">
          <BarChart className="size-16" strokeWidth={1.5}/>
       </div>
      <h3 className="text-2xl font-bold tracking-tight text-foreground">Pronto para Gerar Insights</h3>
      <p className="mt-2 max-w-sm">
        Use os filtros acima para gerar um relatório financeiro detalhado a partir da sua fonte de dados.
      </p>
    </div>
);

const ReportResults = ({ data }: { data: FinancialReport }) => {
    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receita Bruta</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.grossRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <p className="text-xs text-muted-foreground">Receita total no período selecionado</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.totalOrders}</div>
                        <p className="text-xs text-muted-foreground">Número de pedidos com os status selecionados</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                        <ListOrdered className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.averageTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <p className="text-xs text-muted-foreground">Valor médio por pedido</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Produtos Mais Vendidos</CardTitle>
                    <CardDescription>Produtos com maior quantidade vendida no período.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-right">Quantidade Vendida</TableHead>
                                    <TableHead className="text-right">Receita Gerada</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.topSellingProducts.map((product) => (
                                    <TableRow key={product.productId}>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell className="text-right">{product.quantity}</TableCell>
                                        <TableCell className="text-right">{product.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}

    

    