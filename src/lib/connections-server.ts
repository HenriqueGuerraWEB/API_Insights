
import "server-only";
import type { Connection } from "@/hooks/use-connections";

// This is a placeholder for a secure way to store and retrieve connections on the server.
// In a real application, this would be a database, a secure vault, or an environment variable provider.
// For this prototype, we'll use a simple in-memory store.

// IMPORTANT: Never store sensitive data like this in a real production environment.
const connectionsStore: Connection[] = [
    {
        id: "default-wp-1",
        name: "Sativar Local WP",
        baseUrl: "http://localhost:10014",
        apiType: "WordPress",
        auth: {
            type: "basic",
            username: "sativar",
            password: "password"
        }
    }
];

export function getConnections(): Connection[] {
    // In a real app, you would fetch this from a secure database
    // associated with the logged-in user.
    return connectionsStore;
}

export function addConnection(connection: Omit<Connection, "id">) {
    // This is not production-safe. In a real app, you'd save to a DB.
    const newConnection = { ...connection, id: `conn-${Date.now()}`};
    connectionsStore.push(newConnection);
    return newConnection;
}
