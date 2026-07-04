import React from "react";
import { Plus } from "lucide-react";

export function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-sm font-medium transition-opacity">
      <Plus size={13} /> {label}
    </button>
  );
}
