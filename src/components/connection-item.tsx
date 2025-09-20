
"use client";

import { useCallback } from "react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Database, Trash2 } from "lucide-react";

// This is now a "dumb" component. It just receives data and functions.
// It does not know about the global state.
export type Connection = {
  id: string;
  name: string;
  baseUrl: string;
  authMethod: "none" | "bearer" | "apiKey";
  authToken?: string;
  apiKeyHeader?: string;
  apiKeyValue?: string;
};

export function ConnectionItem({
  connection,
  isActive,
  onSelect,
  onDelete,
}: {
  connection: Connection;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {

  // These callbacks are now stable because the onSelect and onDelete props
  // passed from the parent component are stable (wrapped in useCallback).
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent the onSelect from firing.
      onDelete(connection.id);
    },
    [connection.id, onDelete]
  );

  const handleSelect = useCallback(() => {
    onSelect(connection.id);
  }, [connection.id, onSelect]);

  return (
    <SidebarMenuItem className="w-full relative group/item">
      <SidebarMenuButton
        onClick={handleSelect}
        isActive={isActive}
        className="justify-center"
        tooltip={connection.name}
      >
        <Database className="size-4" />
      </SidebarMenuButton>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-[-35px] top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover/item:opacity-100 transition-opacity"
        onClick={handleDelete}
      >
        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </SidebarMenuItem>
  );
}
