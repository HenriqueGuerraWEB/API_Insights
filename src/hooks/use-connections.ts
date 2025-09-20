
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './use-toast';

// A simple in-memory UUID generator since the full `uuid` package might be overkill.
const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


export type Connection = {
  id: string;
  name: string;
  baseUrl: string;
  authMethod: "none" | "bearer" | "apiKey";
  authToken?: string;
  apiKeyHeader?: string;
  apiKeyValue?: string;
};

const CONNECTIONS_STORAGE_KEY = "api-connections";
const ACTIVE_CONNECTION_ID_STORAGE_KEY = "active-connection-id";

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeConnectionId, setActiveConnectionIdState] = useState<string | null>(null);
  const { toast } = useToast();

  // Load initial data from localStorage on client-side mount
  useEffect(() => {
    try {
      const savedConnections = window.localStorage.getItem(CONNECTIONS_STORAGE_KEY);
      if (savedConnections) {
        setConnections(JSON.parse(savedConnections));
      }
      
      const savedActiveId = window.localStorage.getItem(ACTIVE_CONNECTION_ID_STORAGE_KEY);
      if (savedActiveId && savedActiveId !== "null" && savedActiveId !== "undefined") {
         setActiveConnectionIdState(JSON.parse(savedActiveId));
      } else {
         setActiveConnectionIdState(null);
      }

    } catch (error) {
      console.error("Failed to load connections from localStorage", error);
      window.localStorage.removeItem(CONNECTIONS_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_CONNECTION_ID_STORAGE_KEY);
      setConnections([]);
      setActiveConnectionIdState(null);
    }
  }, []);

  const setActiveConnectionId = useCallback((id: string | null) => {
    try {
      setActiveConnectionIdState(id);
      window.localStorage.setItem(ACTIVE_CONNECTION_ID_STORAGE_KEY, JSON.stringify(id));
    } catch (error) {
      console.error("Failed to save active connection ID to localStorage", error);
    }
  }, []);

  const addConnection = useCallback((conn: Omit<Connection, "id">) => {
    const newConnection = { ...conn, id: uuidv4() };
    const updatedConnections = [...connections, newConnection];
    
    setConnections(updatedConnections);
    setActiveConnectionId(newConnection.id);

    try {
      window.localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(updatedConnections));
    } catch (error) {
      console.error("Failed to save connections to localStorage", error);
    }
  }, [connections, setActiveConnectionId]);

  const deleteConnection = useCallback((id: string) => {
    const newConnections = connections.filter(c => c.id !== id);
    setConnections(newConnections);
    
    try {
      window.localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(newConnections));
    } catch (error) {
      console.error("Failed to save connections to localStorage", error);
    }
    
    if (activeConnectionId === id) {
      const newActiveId = newConnections.length > 0 ? newConnections[0].id : null;
      setActiveConnectionId(newActiveId);
    }
    
    toast({
      title: "Conexão Apagada",
      description: "A fonte de dados foi removida com sucesso.",
    });

  }, [connections, activeConnectionId, setActiveConnectionId, toast]);

  const activeConnection = useMemo(
    () => {
        if (!activeConnectionId) return null;
        let found = connections.find(c => c.id === activeConnectionId);

        if (!found && connections.length > 0) {
            const newActiveId = connections[0].id;
            setActiveConnectionId(newActiveId);
            return connections[0];
        } else if (!found && connections.length === 0) {
            setActiveConnectionId(null);
            return null;
        }

        return found || null;
    },
    [connections, activeConnectionId, setActiveConnectionId]
  );

  return {
    connections,
    addConnection,
    deleteConnection,
    activeConnection,
    activeConnectionId,
    setActiveConnectionId,
  };
}
