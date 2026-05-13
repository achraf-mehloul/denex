import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCta?: () => void;
};

export function EmptyState({ icon: Icon, title, description, ctaLabel, ctaTo, onCta }: Props) {
  return (
    <div className="rounded-xl glass p-10 flex flex-col items-center text-center">
      <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center glow-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>
      {ctaLabel && (ctaTo ? (
        <Link to={ctaTo} className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          {ctaLabel}
        </Link>
      ) : (
        <button onClick={onCta} className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          {ctaLabel}
        </button>
      ))}
    </div>
  );
}
