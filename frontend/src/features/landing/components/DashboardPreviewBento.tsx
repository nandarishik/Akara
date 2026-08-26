import MagicBento from "@/shared/effects/MagicBento";

export const AKARA_DASHBOARD_BENTO = [
  {
    color: "#0a0a0a",
    label: "Revenue",
    title: "₹18.3L this week",
    description: "+8% vs last week · North zone leading",
  },
  {
    color: "#0a0a0a",
    label: "KPIs",
    title: "Live dashboard",
    description: "Revenue, orders, parties, growth at a glance",
  },
  {
    color: "#0a0a0a",
    label: "Zones",
    title: "South underperforming",
    description: "−12% WoW · drill down by region",
  },
  {
    color: "#0a0a0a",
    label: "SKUs",
    title: "Top mover: Maggi 70g",
    description: "₹3.2L · scheme ROI tracked",
  },
  {
    color: "#0a0a0a",
    label: "Debrief",
    title: "Weekly brief",
    description: "Monday WhatsApp summary · no login",
  },
  {
    color: "#0a0a0a",
    label: "Copilot",
    title: "Ask anything",
    description: "Hindi or English · answers in seconds",
  },
];

export default function DashboardPreviewBento() {
  return (
    <MagicBento
      items={AKARA_DASHBOARD_BENTO}
      textAutoHide
      enableStars
      enableSpotlight
      enableBorderGlow
      enableTilt
      enableMagnetism
      clickEffect
      spotlightRadius={280}
      particleCount={10}
      glowColor="56, 179, 248"
    />
  );
}
