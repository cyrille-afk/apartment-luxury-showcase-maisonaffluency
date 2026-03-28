export interface BrandEntry {
  id: string;
  brand_name: string;
  category: string;
  urls_text: string;
  location: string;
}

export interface SavedConfig {
  id: string;
  brand_name: string;
  category: string;
  urls: string[];
  is_active: boolean;
  schedule_cron: string | null;
  last_run_at: string | null;
  last_run_result: any;
  chunk_size: number;
  chunk_delay: number;
  location: string;
}

export const COUNTRY_OPTIONS = [
  { label: "Auto (default)", value: "" },
  { label: "🇫🇷 France", value: "FR" },
  { label: "🇮🇹 Italy", value: "IT" },
  { label: "🇺🇸 United States", value: "US" },
  { label: "🇬🇧 United Kingdom", value: "GB" },
  { label: "🇩🇪 Germany", value: "DE" },
  { label: "🇪🇸 Spain", value: "ES" },
  { label: "🇵🇹 Portugal", value: "PT" },
  { label: "🇳🇱 Netherlands", value: "NL" },
  { label: "🇧🇪 Belgium", value: "BE" },
  { label: "🇸🇪 Sweden", value: "SE" },
  { label: "🇩🇰 Denmark", value: "DK" },
  { label: "🇯🇵 Japan", value: "JP" },
  { label: "🇸🇬 Singapore", value: "SG" },
  { label: "🇦🇺 Australia", value: "AU" },
  { label: "🇧🇷 Brazil", value: "BR" },
  { label: "🇮🇳 India", value: "IN" },
];

export const SCHEDULE_OPTIONS = [
  { label: "Manual only", value: "" },
  { label: "Daily", value: "0 3 * * *" },
  { label: "Weekly (Mon)", value: "0 3 * * 1" },
  { label: "Monthly (1st)", value: "0 3 1 * *" },
];
