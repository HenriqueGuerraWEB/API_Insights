
"use client";

import { useCallback } from "react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Database, Trash2 } from "lucide-react";
import type { Connection } from "./api-explorer-page";

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
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
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

    