import React from "react";
import { SuggestionList, SuggestionItem } from "./RephraseSuggestions.styles";

interface Props {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

const RephraseSuggestions: React.FC<Props> = ({ suggestions, onSelect }) => {
  if (!suggestions.length) return null;
  return (
    <SuggestionList>
      {suggestions.map((s, idx) => (
        <SuggestionItem key={idx} onClick={() => onSelect(s)}>
          {s}
        </SuggestionItem>
      ))}
    </SuggestionList>
  );
};

export default RephraseSuggestions;
