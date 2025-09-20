
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
  authMethod: "none" | "bearer" | "apiKey" | "basic";
  authToken?: string;
  apiKeyHeader?: string;
  apiKeyValue?: string;
  basicUser?: string;
  basicPass?: string;
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
        const parsedConnections = JSON.parse(savedConnections);
        setConnections(parsedConnections);
      }
      
      const savedActiveId = window.localStorage.getItem(ACTIVE_CONNECTION_ID_STORAGE_KEY);
      if (savedActiveId && savedActiveId !== "null" && savedActiveId !== "undefined") {
         setActiveConnectionIdState(JSON.parse(savedActiveId));
      } else {
         setActiveConnectionIdState(null);
      }

    } catch (error) {
      console.error("Failed to load connections from localStorage", error);
      toast({ variant: "destructive", title: "Erro ao Carregar Dados", description: "Não foi possível carregar as conexões salvas."})
      window.localStorage.removeItem(CONNECTIONS_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_CONNECTION_ID_STORAGE_KEY);
      setConnections([]);
      setActiveConnectionIdState(null);
    }
  }, [toast]);

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
      toast({ variant: "destructive", title: "Erro ao Salvar", description: "Não foi possível atualizar as conexões salvas." });
    }
    
    if (activeConnectionId === id) {
       setActiveConnectionId(newConnections.length > 0 ? newConnections[0].id : null);
    }
    
    toast({
      title: "Conexão Apagada",
      description: "A fonte de dados foi removida com sucesso.",
    });

  }, [connections, activeConnectionId, setActiveConnectionId, toast]);

  const activeConnection = useMemo(
    () => {
        if (!activeConnectionId) return null;
        const found = connections.find(c => c.id === activeConnectionId);

        // If the active ID is invalid (e.g., deleted), clear it.
        if (!found) {
            setActiveConnectionId(null);
            return null;
        }

        return found;
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
