import { ShieldCheck, Target, Swords, Sparkles, Trophy } from "lucide-react";

export const getIcon = (iconName: any) => {
  const icons: any = {
    ShieldCheck,
    Target,
    Swords,
    Sparkles,
    Trophy,
  };

  if (typeof iconName === "string" && icons[iconName]) return icons[iconName];
  if (typeof iconName === "function") return iconName;
  if (iconName && typeof iconName === "object" && iconName.displayName)
    return iconName; // Possible forwardRef

  return ShieldCheck;
};

export const logoOf = (tag: string, availableTeams: any[] = []) =>
  (availableTeams || []).find((tm: any) => tm.tag === tag)?.logo || "";
