
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from "uuid";
import { useToast } from './use-toast';

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
      if (savedActiveId) {
        setActiveConnectionIdState(JSON.parse(savedActiveId));
      }
    } catch (error) {
      console.error("Failed to load connections from localStorage", error);
    }
  }, []); // Empty dependency array ensures this runs only once

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
    setConnections(prev => {
      const updatedConnections = [...prev, newConnection];
      try {
        window.localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(updatedConnections));
      } catch (error) {
        console.error("Failed to save connections to localStorage", error);
      }
      setActiveConnectionId(newConnection.id);
      return updatedConnections;
    });
  }, [setActiveConnectionId]);

  const deleteConnection = useCallback((id: string) => {
    if (connections.length <= 1) {
      toast({
        variant: "destructive",
        title: "Ação não permitida",
        description: "Não é possível apagar a última fonte de dados existente.",
      });
      return;
    }
    
    setConnections(prev => {
      const newConnections = prev.filter(c => c.id !== id);
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

      return newConnections;
    });
  }, [connections.length, activeConnectionId, setActiveConnectionId, toast]);

  const activeConnection = useMemo(
    () => connections.find(c => c.id === activeConnectionId) || null,
    [connections, activeConnectionId]
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

