
'use server';

import { suggestFriendlyNames } from '@/ai/flows/ai-schema-assistant';
import { z } from 'zod';

const fetchApiDataInputSchema = z.object({
  url: z.string().url({ message: "URL inválida." }),
  apiType: z.enum(["wordpress", "generic"]),
  path: z.string(),
  method: z.string(),
  headers: z.record(z.string()),
  body: z.string().nullable(),
});

export type FetchApiDataOutput = {
  data: any;
  suggestedNames: Record<string, string>;
  error?: string;
  namespace?: string | null;
};

// Helper function to build the final URL based on API type
function buildUrl(baseUrl: string, path: string): string {
    const finalBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const finalPath = path.startsWith('/') ? path : `/${path}`;
    
    // Simple concatenation is now the rule. The base URL from the connection
    // is the source of truth. The path from the form is relative to that.
    return `${finalBaseUrl}${finalPath}`;
}


// In-memory cache for this server instance. For a more robust solution,
// consider a shared cache like Redis.
const aiNameSuggestionCache: Record<string, Record<string, string>> = {};

// Function to get or fetch AI-suggested names from localStorage cache first
async function getOrFetchAiSuggestions(cacheKey: string, keys: string[]): Promise<Record<string, string>> {
    
    // For client-side localStorage access, this function would need to be a client-side utility.
    // Given this is a server action, we will stick to in-memory cache.
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
    
    let url = buildUrl(validatedInput.url, validatedInput.path);

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
      try {
        // Try to parse error for more details (like WordPress rest_no_route)
        const errorJson = JSON.parse(errorText);
        const detailedError = errorJson.message || JSON.stringify(errorJson);
        return { data: null, suggestedNames: {}, namespace: null, error: `Erro: ${response.status} ${response.statusText}. Detalhes: ${detailedError}` };
      } catch (e) {
        return { data: null, suggestedNames: {}, namespace: null, error: `Erro: ${response.status} ${response.statusText}. ${errorText}` };
      }
    }

    const data = await response.json();
    const dataArray = Array.isArray(data) ? data : [data];

    if (dataArray.length === 0) {
      return { data: [], suggestedNames: {}, namespace: null, error: 'A resposta da API está vazia.' };
    }
    
    const firstItem = dataArray[0];
    const namespace = (firstItem && typeof firstItem === 'object' && 'namespace' in firstItem) ? firstItem.namespace : null;

    const cacheKey = `${validatedInput.url}${validatedInput.path}`;
    
    const keys = Array.from(new Set(dataArray.flatMap(item => typeof item === 'object' && item !== null ? Object.keys(item) : [])));
    
    const suggestedNames = await getOrFetchAiSuggestions(cacheKey, keys);

    return { data: dataArray, suggestedNames, namespace };

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
