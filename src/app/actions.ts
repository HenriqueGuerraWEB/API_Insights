'use server';

import { suggestFriendlyNames } from '@/ai/flows/ai-schema-assistant';
import { z } from 'zod';

const fetchApiDataInputSchema = z.object({
  url: z.string().url({ message: "URL inválida." }),
  method: z.string(),
  headers: z.record(z.string()),
  body: z.string().nullable(),
});

export type FetchApiDataOutput = {
  data: any;
  suggestedNames: Record<string, string>;
  error?: string;
};

export async function fetchApiData(input: z.infer<typeof fetchApiDataInputSchema>): Promise<FetchApiDataOutput> {
  try {
    const validatedInput = fetchApiDataInputSchema.parse(input);
    
    // Prepend https:// if no protocol is present
    let url = validatedInput.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }


    const response = await fetch(url, {
      method: validatedInput.method,
      headers: new Headers(validatedInput.headers),
      body: validatedInput.method === 'POST' || validatedInput.method === 'PUT' ? validatedInput.body : null,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, suggestedNames: {}, error: `Erro: ${response.status} ${response.statusText}. ${errorText}` };
    }

    const data = await response.json();
    const dataArray = Array.isArray(data) ? data : [data];

    if (dataArray.length === 0 || (dataArray.length === 1 && Object.keys(dataArray[0]).length === 0)) {
      return { data: [], suggestedNames: {}, error: 'A resposta da API está vazia ou não é um JSON válido.' };
    }

    const keys = Array.from(new Set(dataArray.flatMap(item => Object.keys(item))));
    
    if (keys.length === 0) {
       return { data: dataArray, suggestedNames: {}, error: 'Nenhuma chave encontrada nos dados da API.' };
    }

    const suggestedNames = await suggestFriendlyNames({ apiKeys: keys });

    return { data: dataArray, suggestedNames };

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { data: null, suggestedNames: {}, error: `Dados de entrada inválidos: ${error.errors.map(e => e.message).join(', ')}` };
    }
     if (error.message.includes('fetch failed')) {
        return { data: null, suggestedNames: {}, error: 'Falha na conexão. Verifique a URL e a conexão com a internet.' };
    }
    return { data: null, suggestedNames: {}, error: error.message || 'Ocorreu um erro desconhecido.' };
  }
}

const exportDataInputSchema = z.object({
  data: z.array(z.record(z.any())),
  columns: z.array(z.object({
    key: z.string(),
    name: z.string(),
  })),
  format: z.enum(['json', 'csv', 'pdf']),
});

export type ExportDataOutput = {
    content: string;
    mimeType: string;
    fileName: string;
    error?: string;
}

function convertToCSV(data: any[], columns: { key: string, name: string }[]): string {
    const header = columns.map(c => `"${c.name}"`).join(',') + '\r\n';
    const rows = data.map(row => {
        return columns.map(col => {
            const value = row[col.name]; // Use the renamed key
            if (value === null || value === undefined) return '';
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return `"${stringValue.replace(/"/g, '""')}"`;
        }).join(',');
    }).join('\r\n');
    return header + rows;
}

export async function exportData(input: z.infer<typeof exportDataInputSchema>): Promise<ExportDataOutput> {
    try {
        const { data, columns, format } = exportDataInputSchema.parse(input);

        const processedData = data.map(row => {
            const newRow: Record<string, any> = {};
            for (const col of columns) {
                if (row.hasOwnProperty(col.key)) {
                    newRow[col.name] = row[col.key];
                }
            }
            return newRow;
        });

        if (format === 'json') {
            return {
                content: JSON.stringify(processedData, null, 2),
                mimeType: 'application/json',
                fileName: `report-${Date.now()}.json`,
            };
        }

        if (format === 'csv') {
            const csvColumns = columns.map(c => ({ key: c.key, name: c.name }));
            return {
                content: convertToCSV(processedData, csvColumns),
                mimeType: 'text/csv;charset=utf-8;',
                fileName: `report-${Date.now()}.csv`,
            };
        }
        
        if (format === 'pdf') {
             return { content: '', mimeType: '', fileName: '', error: "Exportação para PDF ainda não implementada." };
        }

        return { content: '', mimeType: '', fileName: '', error: `Formato de exportação inválido: ${format}`};

    } catch (error: any) {
        if (error instanceof z.ZodError) {
          return { content: '', mimeType: '', fileName: '', error: `Dados de entrada inválidos: ${error.errors.map(e => e.message).join(', ')}` };
        }
        return { content: '', mimeType: '', fileName: '', error: error.message || 'Ocorreu um erro desconhecido durante a exportação.' };
    }
}
