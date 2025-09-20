
import { NextRequest, NextResponse } from "next/server";
import { getConnections } from "@/lib/connections-server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const connectionId = searchParams.get('connectionId');

    if (!startDate || !endDate || !status || !connectionId) {
        return NextResponse.json({ error: 'Parâmetros ausentes: startDate, endDate, status e connectionId são obrigatórios.' }, { status: 400 });
    }

    try {
        const connections = getConnections();
        const connection = connections.find(c => c.id === connectionId);

        if (!connection) {
            return NextResponse.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
        }
        
        if (connection.apiType !== 'WordPress') {
             return NextResponse.json({ error: 'Relatórios financeiros estão disponíveis apenas para conexões do tipo WordPress.' }, { status: 400 });
        }

        // Use o endpoint de pedidos que você deve ter criado no seu plugin customizado
        const endpoint = '/orders';
        const fullUrl = new URL(connection.baseUrl + endpoint);

        fullUrl.searchParams.append('start_date', startDate);
        fullUrl.searchParams.append('end_date', endDate);
        fullUrl.searchParams.append('status', status);
        
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        
        if (connection.auth.type === 'basic') {
            const basicAuth = Buffer.from(`${connection.auth.username}:${connection.auth.password}`).toString('base64');
            headers['Authorization'] = `Basic ${basicAuth}`;
        }
        
        const apiResponse = await fetch(fullUrl.toString(), {
            method: 'GET',
            headers: new Headers(headers),
            cache: 'no-store',
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            try {
                const errorJson = JSON.parse(errorText);
                const detailedError = errorJson.message || JSON.stringify(errorJson);
                throw new Error(`Erro da API externa: ${apiResponse.status} ${apiResponse.statusText}. Detalhes: ${detailedError}`);
            } catch (e) {
                throw new Error(`Erro da API externa: ${apiResponse.status} ${apiResponse.statusText}. ${errorText}`);
            }
        }

        const data = await apiResponse.json();
        return NextResponse.json(data);

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Ocorreu um erro desconhecido no servidor.' }, { status: 500 });
    }
}
