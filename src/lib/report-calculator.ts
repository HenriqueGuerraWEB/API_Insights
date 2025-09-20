

// Tipos de entrada e saída
// Estes tipos devem espelhar a estrutura dos seus dados de pedidos do WooCommerce

type OrderLineItem = {
    product_id: number;
    name: string;
    quantity: number;
    total: string; // Vem como string da API do WC
};

type Order = {
    id: number;
    total: string; // Vem como string da API do WC
    line_items: OrderLineItem[];
};

export type FinancialReportInput = {
    startDate: string;
    endDate: string;
    status: string;
    connectionId: string;
};

export type FinancialReport = {
    grossRevenue: number;
    totalOrders: number;
    averageTicket: number;
    topSellingProducts: {
        productId: number;
        name: string;
        quantity: number;
        totalRevenue: number;
    }[];
};

/**
 * Calcula métricas financeiras a partir de uma lista de pedidos.
 * @param orders Array de objetos de pedido da API do WooCommerce.
 * @returns Um objeto com as métricas financeiras calculadas.
 */
export function calculateFinancialMetrics(orders: Order[]): FinancialReport {
    if (!Array.isArray(orders) || orders.length === 0) {
        return {
            grossRevenue: 0,
            totalOrders: 0,
            averageTicket: 0,
            topSellingProducts: [],
        };
    }

    // 1. Calcular Receita Bruta e Total de Pedidos
    const grossRevenue = orders.reduce((acc, order) => {
        return acc + parseFloat(order.total || '0');
    }, 0);

    const totalOrders = orders.length;

    // 2. Calcular Ticket Médio
    const averageTicket = totalOrders > 0 ? grossRevenue / totalOrders : 0;

    // 3. Agregar dados dos produtos
    const productData: Record<number, {
        productId: number;
        name: string;
        quantity: number;
        totalRevenue: number;
    }> = {};

    orders.forEach(order => {
        order.line_items.forEach(item => {
            if (!productData[item.product_id]) {
                productData[item.product_id] = {
                    productId: item.product_id,
                    name: item.name,
                    quantity: 0,
                    totalRevenue: 0,
                };
            }
            productData[item.product_id].quantity += item.quantity;
            productData[item.product_id].totalRevenue += parseFloat(item.total || '0');
        });
    });

    // 4. Converter o objeto de produtos em um array e ordenar
    const topSellingProducts = Object.values(productData)
        .sort((a, b) => b.quantity - a.quantity) // Ordenar por quantidade vendida
        .slice(0, 10); // Limitar aos top 10

    return {
        grossRevenue,
        totalOrders,
        averageTicket,
        topSellingProducts,
    };
}
