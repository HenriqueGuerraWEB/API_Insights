
"use client";

import {
  Sidebar as SidebarPrimitive,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Rocket } from "lucide-react";

import type { Connection } from "@/hooks/use-connections";
import { ConnectionItem } from "@/components/connection-item";

type SidebarProps = {
  connections: Connection[];
  activeConnectionId: string | null;
  onAddConnection: () => void;
  onDeleteConnection: (id: string) => void;
  onSelectConnection: (id: string) => void;
};

export function Sidebar({
  connections,
  activeConnectionId,
  onAddConnection,
  onDeleteConnection,
  onSelectConnection,
}: SidebarProps) {
  return (
    <SidebarPrimitive>
      <SidebarHeader className="p-4 flex justify-center">
        <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg border border-primary/20">
          <Rocket className="size-5 text-primary" />
        </div>
      </SidebarHeader>
      <SidebarContent className="p-0">
        <ScrollArea className="h-full">
          <SidebarMenu className="p-4 flex flex-col items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-center h-10 w-10 p-0"
                  onClick={onAddConnection}
                >
                  <Plus className="size-4" />
                </Button>
              </DialogTrigger>
            </Dialog>

            {connections.map((conn) => (
              <ConnectionItem
                key={conn.id}
                connection={conn}
                isActive={activeConnectionId === conn.id}
                onSelect={onSelectConnection}
                onDelete={onDeleteConnection}
              />
            ))}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>
    </SidebarPrimitive>
  );
}

