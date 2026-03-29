import { useState } from "react";
import { api } from "../lib/api";

export function useStatusSuggestion() {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);

  const fetchSuggestion = async () => {
    setIsLoadingSuggestion(true);
    try {
      const { data } = await api.post("/ai/suggest");
      setSuggestion(data.suggestion ?? null);
    } catch {
      // Suggestion is a nice-to-have — fail silently
      setSuggestion(null);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  return { suggestion, isLoadingSuggestion, fetchSuggestion };
}
