import React from "react";

type InventoryType = "medicines" | "emergency" | "general";

interface Props {
  value: InventoryType;
  onChange: (val: InventoryType) => void;
}

const options: {
  id: InventoryType;
  label: string;
}[] = [
  {
    id: "medicines",
    label: "Medicines",
  },
  {
    id: "emergency",
    label: "Emergency",
  },
  {
    id: "general",
    label: "General",
  },
];

export function InventoryTypeSelector({ value, onChange }: Props) {
  return (
    <div className="w-full mb-6">
      <div className="flex w-full rounded-full bg-[#D6E4F0] p-1 border border-[#B3CDED]">
        {options.map((opt) => {
          const active = value === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={active}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-full transition-all duration-300
                ${
                  active
                    ? "bg-[#123B6B] text-white shadow-md"
                    : "text-[#123B6B] hover:bg-[#B3CDED]"
                }
              `}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
