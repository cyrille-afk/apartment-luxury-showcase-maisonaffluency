import { useNavigate } from "react-router-dom";
import {
  Image, Users, FolderOpen, Layers, FileText, FileSpreadsheet, Scissors,
  Columns, Paintbrush, MessageCircle, CalendarClock, Package, Truck,
  CalendarDays, Wallet, RefreshCw, ArrowRightLeft, GraduationCap, Box, BookOpen,
} from "lucide-react";

type Tool = { title: string; description: string; url: string; icon: any };
type ToolCategory = { label: string; tools: Tool[] };

const categories: ToolCategory[] = [
  {
    label: "Discover",
    tools: [
      { title: "Gallery", description: "Browse curated interiors and installations", url: "/trade/gallery", icon: Image },
      { title: "Designers & Ateliers", description: "Explore our represented makers", url: "/trade/designers", icon: Users },
      { title: "Resources", description: "Catalogues, price lists & tech sheets", url: "/trade/documents", icon: FolderOpen },
      { title: "Material Library", description: "Swatches, finishes & fabric samples", url: "/trade/materials", icon: Layers },
    ],
  },
  {
    label: "Specification",
    tools: [
      { title: "Quote Builder", description: "Build and submit project quotes", url: "/trade/quotes", icon: FileText },
      { title: "FF&E Schedule", description: "Auto-generate furniture schedules", url: "/trade/ffe-schedule", icon: FileSpreadsheet },
      { title: "Tearsheet Builder", description: "Create printable product specs", url: "/trade/tearsheets", icon: Scissors },
      { title: "Product Comparator", description: "Compare specs side by side", url: "/trade/comparator", icon: Columns },
      { title: "Mood Board", description: "Visual collage for client presentations", url: "/trade/mood-boards", icon: Paintbrush },
      { title: "Markup & Annotation", description: "Annotate images and drawings", url: "/trade/annotations", icon: MessageCircle },
    ],
  },
  {
    label: "Procurement",
    tools: [
      { title: "Order Timeline", description: "Track orders from deposit to delivery", url: "/trade/order-timeline", icon: CalendarClock },
      { title: "Sample Requests", description: "Request and track material samples", url: "/trade/samples", icon: Package },
      { title: "Shipping Tracker", description: "Real-time delivery progress", url: "/trade/shipping-tracker", icon: Truck },
      { title: "Lead Time Calendar", description: "Production and shipping timelines", url: "/trade/lead-time-calendar", icon: CalendarDays },
      { title: "Budget Tracker", description: "Monitor project spend vs budget", url: "/trade/budget", icon: Wallet },
      { title: "Reorder", description: "Quickly re-order from past quotes", url: "/trade/reorder", icon: RefreshCw },
      { title: "Currency Converter", description: "Convert trade prices across currencies", url: "/trade/currency-converter", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Learn",
    tools: [
      { title: "CPD & Education", description: "Webinars, workshops & CPD tracking", url: "/trade/cpd", icon: GraduationCap },
      { title: "3D Studio", description: "3ds Max + Corona/V-Ray rendering pipeline", url: "/trade/axonometric-requests", icon: Box },
    ],
  },
];

export default function TradeTools() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">Tools</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Everything you need to discover, specify and procure — all in one place.
        </p>
      </div>

      {categories.map((cat) => (
        <section key={cat.label}>
          <h2 className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground mb-4">
            {cat.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {cat.tools.map((tool) => (
              <button
                key={tool.url}
                onClick={() => navigate(tool.url)}
                className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-background hover:bg-muted/50 hover:border-foreground/20 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-foreground/10 transition-colors">
                  <tool.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="min-w-0">
                  <span className="font-body text-sm font-medium text-foreground block">{tool.title}</span>
                  <span className="font-body text-xs text-muted-foreground leading-snug block mt-0.5">
                    {tool.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
