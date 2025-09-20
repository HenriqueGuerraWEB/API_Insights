'use server';

import { suggestFriendlyNames } from '@/ai/flows/ai-schema-assistant';
import type { Connection } from '@/hooks/use-connections';
import { z } from 'zod';

const fetchApiDataInputSchema = z.object({
  connection: z.custom<Connection>(),
  url: z.string(),
  method: z.string(),
  params: z.array(z.object({ key: z.string(), value: z.string() })),
  headers: z.array(z.object({ key: z.string(), value: z.string() })),
  body: z.string().nullable(),
});

export type FetchApiDataOutput = {
  data: any;
  suggestedNames: Record<string, string>;
  error?: string;
  namespace?: string | null;
};

function buildUrlWithParams(url: string, params: {key: string, value: string}[]): string {
    const urlObject = new URL(url);
    params.forEach(p => {
        if (p.key) {
            urlObject.searchParams.append(p.key, p.value);
        }
    });
    return urlObject.toString();
}


const aiNameSuggestionCache: Record<string, Record<string, string>> = {};

async function getOrFetchAiSuggestions(cacheKey: string, keys: string[]): Promise<Record<string, string>> {
    
    if (aiNameSuggestionCache[cacheKey]) {
        return aiNameSuggestionCache[cacheKey];
    }
    
    if (keys.length === 0) {
        return {};
    }

    try {
        const suggestionOutput = await suggestFriendlyNames({ apiKeys: keys });
        const suggestedNames = suggestionOutput.suggestions.reduce((acc, { key, friendlyName }) => {
            acc[key] = friendlyName;
            return acc;
        }, {} as Record<string, string>);
        
        aiNameSuggestionCache[cacheKey] = suggestedNames;
        return suggestedNames;
    } catch (aiError: any) {
        console.error("AI suggestion failed:", aiError);
        return keys.reduce((acc, key) => {
            acc[key] = key;
            return acc;
        }, {} as Record<string, string>);
    }
}


export async function fetchApiData(input: z.infer<typeof fetchApiDataInputSchema>): Promise<FetchApiDataOutput> {
  try {
    const validatedInput = fetchApiDataInputSchema.parse(input);
    const { connection, url, method, params, headers: customHeaders, body } = validatedInput;

    const finalUrl = buildUrlWithParams(url, params);
    
    const finalHeaders: Record<string, string> = { "Content-Type": "application/json" };
    
    customHeaders.forEach(h => {
        if (h.key) finalHeaders[h.key] = h.value;
    });

    if (connection.authMethod === 'bearer' && connection.authToken) {
        finalHeaders['Authorization'] = `Bearer ${connection.authToken}`;
    } else if (connection.authMethod === 'apiKey' && connection.apiKeyHeader && connection.apiKeyValue) {
        finalHeaders[connection.apiKeyHeader] = connection.apiKeyValue;
    } else if (connection.authMethod === 'basic' && connection.basicUser && connection.basicPass) {
        const basicAuth = Buffer.from(`${connection.basicUser}:${connection.basicPass}`).toString('base64');
        finalHeaders['Authorization'] = `Basic ${basicAuth}`;
    }

    const response = await fetch(finalUrl, {
      method: method,
      headers: new Headers(finalHeaders),
      body: (method === 'POST' || method === 'PUT') && body ? body : null,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        const detailedError = errorJson.message || JSON.stringify(errorJson);
        return { data: null, suggestedNames: {}, namespace: null, error: `Erro: ${response.status} ${response.statusText}. Detalhes: ${detailedError}` };
      } catch (e) {
        return { data: null, suggestedNames: {}, namespace: null, error: `Erro: ${response.status} ${response.statusText}. ${errorText}` };
      }
    }

    const data = await response.json();
    const dataIsArray = Array.isArray(data);
    
    if (dataIsArray && data.length === 0) {
      return { data: [], suggestedNames: {}, namespace: null };
    }
    
    if (!dataIsArray && typeof data === 'object' && data !== null && Object.keys(data).length === 0) {
      return { data: [], suggestedNames: {}, namespace: null, error: 'A resposta da API retornou um objeto vazio.' };
    }
    
    const dataForKeys = dataIsArray ? data : [data];

    const firstItem = dataForKeys[0];
    const namespace = (firstItem && typeof firstItem === 'object' && 'namespace' in firstItem) ? firstItem.namespace : null;

    const cacheKey = `ai-suggestions:${url}`;
    
    const keys = Array.from(new Set(dataForKeys.flatMap(item => typeof item === 'object' && item !== null ? Object.keys(item) : [])));
    
    const suggestedNames = await getOrFetchAiSuggestions(cacheKey, keys);

    return { data, suggestedNames, namespace };

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { data: null, suggestedNames: {}, namespace: null, error: `Dados de entrada inválidos: ${error.errors.map(e => e.message).join(', ')}` };
    }
     if (error.message.includes('fetch failed')) {
        return { data: null, suggestedNames: {}, namespace: null, error: 'Falha na conexão. Verifique a URL e a conexão com a internet.' };
    }
    return { data: null, suggestedNames: {}, namespace: null, error: error.message || 'Ocorreu um erro desconhecido.' };
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