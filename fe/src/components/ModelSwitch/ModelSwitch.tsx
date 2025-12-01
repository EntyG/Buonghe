import React from "react";
import { Button } from "@mui/material";

type ModelOption = { key: string; label: string };

type Props = {
  value: string;
  options: ModelOption[];
  onChange: (key: string) => void;
};

const ModelSwitch: React.FC<Props> = ({ value, options, onChange }) => {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {options.map((m) => (
        <Button
          key={m.key}
          variant={value === m.key ? "contained" : "outlined"}
          size="small"
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </Button>
      ))}
    </div>
  );
};

export default ModelSwitch;
