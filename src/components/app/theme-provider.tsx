import { useEffect, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyDreamSkin, applyThemeVars, resolveTheme } from "@/lib/theme";
import { findTheme, useApp } from "@/lib/store";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeId = useApp((s) => s.themeId);
  const appearance = useApp((s) => s.appearance);
  const customThemes = useApp((s) => s.customThemes);

  useEffect(() => {
    const entry = findTheme(themeId);
    const resolved = resolveTheme(entry.file, appearance);
    applyThemeVars(resolved);
    applyDreamSkin(entry.dreamSkin, entry.wallpaper, entry.dreamCss);
  }, [themeId, appearance, customThemes]);

  return <TooltipProvider>{children}</TooltipProvider>;
}
