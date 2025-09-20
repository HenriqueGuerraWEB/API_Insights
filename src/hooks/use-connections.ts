
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './use-toast';

const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export type Auth = 
    | { type: 'none' }
    | { type: 'basic'; username?: string; password?: string }
    | { type: 'bearer'; token?: string }
    | { type: 'apiKey'; headerName?: string; apiKey?: string }
    | { type: 'wooCommerce'; consumerKey?: string; consumerSecret?: string };

export type Connection = {
  id: string;
  name: string;
  baseUrl: string;
  apiType: 'Generic' | 'WordPress';
  auth: Auth;
};

const CONNECTIONS_STORAGE_KEY = "api-connections-v2";
const ACTIVE_CONNECTION_ID_STORAGE_KEY = "active-connection-id-v2";

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeConnectionId, setActiveConnectionIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    try {
      const savedConnections = window.localStorage.getItem(CONNECTIONS_STORAGE_KEY);
      const savedConnectionsParsed = savedConnections ? JSON.parse(savedConnections) : [];
      setConnections(savedConnectionsParsed);
      
      const savedActiveId = window.localStorage.getItem(ACTIVE_CONNECTION_ID_STORAGE_KEY);
      if (savedActiveId && savedActiveId !== "null" && savedActiveId !== "undefined") {
         setActiveConnectionIdState(JSON.parse(savedActiveId));
      } else {
         const defaultActiveId = savedConnectionsParsed.length > 0 ? savedConnectionsParsed[0].id : null;
         setActiveConnectionIdState(defaultActiveId);
         if (defaultActiveId) {
            window.localStorage.setItem(ACTIVE_CONNECTION_ID_STORAGE_KEY, JSON.stringify(defaultActiveId));
         }
      }
    } catch (error) {
      console.error("Failed to load connections from localStorage", error);
      toast({ variant: "destructive", title: "Erro ao Carregar Dados", description: "Não foi possível carregar as conexões salvas."})
      window.localStorage.removeItem(CONNECTIONS_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_CONNECTION_ID_STORAGE_KEY);
      setConnections([]);
      setActiveConnectionIdState(null);
    } finally {
        setIsLoading(false);
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
        if (isLoading || !activeConnectionId) return null;
        let found = connections.find(c => c.id === activeConnectionId);

        if (!found && connections.length > 0) {
            found = connections[0];
            setActiveConnectionId(connections[0].id);
        } else if (!found) {
            setActiveConnectionId(null);
            return null;
        }

        return found;
    },
    [connections, activeConnectionId, setActiveConnectionId, isLoading]
  );

  return {
    connections,
    addConnection,
    deleteConnection,
    activeConnection,
    activeConnectionId,
    setActiveConnectionId,
    isLoading,
  };
}
