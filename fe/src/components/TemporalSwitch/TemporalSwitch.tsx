import React from "react";
import { Tooltip } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { TemporalButton } from "./TemporalSwitch.styles";

interface TemporalSwitchProps {
  isActive: boolean;
  onChange: () => void;
  disabled?: boolean;
}

const TemporalSwitch: React.FC<TemporalSwitchProps> = ({
  isActive,
  onChange,
  disabled = false,
}) => {
  return (
    <Tooltip
      title={isActive ? "Exit Temporal Search Mode" : "Temporal Search Mode"}
      placement="right"
      arrow
    >
      <span>
        <TemporalButton
          active={isActive}
          onClick={onChange}
          disabled={disabled}
          aria-label={isActive ? "Exit Temporal Search" : "Enter Temporal Search"}
        >
          <AccessTimeIcon />
        </TemporalButton>
      </span>
    </Tooltip>
  );
};

export default TemporalSwitch;
