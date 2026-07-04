import { pct } from "../../lib/formatters";

interface Colors { text: string; bg: string; border: string }

function getColors(m: number): Colors {
  if (m >= 50) return { text: "#059669", bg: "rgba(5,150,105,0.12)",   border: "rgba(5,150,105,0.35)"   };
  if (m >= 25) return { text: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.35)"  };
  if (m >= 10) return { text: "#d97706", bg: "rgba(217,119,6,0.12)",   border: "rgba(217,119,6,0.35)"   };
  if (m >= 0)  return { text: "#ea580c", bg: "rgba(234,88,12,0.12)",   border: "rgba(234,88,12,0.35)"   };
  return        { text: "#dc2626", bg: "rgba(220,38,38,0.12)",   border: "rgba(220,38,38,0.35)"   };
}

export function MarginBadge({ margin }: { margin: number }) {
  const { text, bg, border } = getColors(margin);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-widest border"
      style={{ color: text, backgroundColor: bg, borderColor: border }}
    >
      {pct(margin)}
    </span>
  );
}
