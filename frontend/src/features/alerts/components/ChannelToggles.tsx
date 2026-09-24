import { cn } from "@/lib/utils";

export type ChannelState = {
  email: boolean;
  whatsapp: boolean;
  in_app: boolean;
};

export function ChannelToggles({
  value,
  onChange,
  whatsappDisabled,
}: {
  value: ChannelState;
  onChange: (next: ChannelState) => void;
  whatsappDisabled?: boolean;
}) {
  const row = (
    key: keyof ChannelState,
    label: string,
    disabled?: boolean,
    title?: string,
  ) => (
    <label
      className={cn(
        "flex items-center gap-2 text-sm",
        disabled && "opacity-40 cursor-not-allowed",
      )}
      title={title}
    >
      <input
        type="checkbox"
        checked={value[key]}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
      />
      {label}
    </label>
  );

  return (
    <div className="flex flex-wrap gap-4">
      {row("email", "Email")}
      {row(
        "whatsapp",
        "WhatsApp",
        whatsappDisabled,
        whatsappDisabled ? "WhatsApp alerts are disabled for this workspace" : undefined,
      )}
      {row("in_app", "In-app")}
    </div>
  );
}
