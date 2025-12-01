import React, { useState } from "react";
import { Tooltip, Popover } from "@mui/material";
import TimelineIcon from "@mui/icons-material/Timeline";
import PlaceIcon from "@mui/icons-material/Place";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import MovieIcon from "@mui/icons-material/Movie";
import { ClusterMode } from "../../types";
import { MainModeButton, MenuButton } from "./ModeSwitch.styles";

const modes: {
  key: ClusterMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  // { key: "timeline", label: "Timeline", icon: <TimelineIcon /> },
  // { key: "location", label: "Location", icon: <PlaceIcon /> },
  { key: "moment", label: "Moment", icon: <FlashOnIcon /> },
  { key: "video", label: "Video", icon: <MovieIcon /> },
];

type Props = {
  mode: ClusterMode;
  onChange: (mode: ClusterMode) => void;
  disabled?: boolean;
};

const ModeSwitch: React.FC<Props> = ({ mode, onChange, disabled = false }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // do not optimistically change UI here; reflect the parent `mode` prop
  const current = modes.find((m) => m.key === mode) || modes[0];

  // left-click toggles between modes, right-click opens the popover for explicit selection
  const handleButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    // toggle between moment and video; let parent perform the change and update the prop
    const next = mode === "moment" ? "video" : "moment";
    onChange(next);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title={disabled ? "Mode switch disabled in temporal search" : current.label} placement="right">
        <MainModeButton
          onClick={handleButtonClick}
          onContextMenu={handleContextMenu}
          aria-label={current.label}
          style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {current.icon}
        </MainModeButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "center",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "center",
          horizontal: "left",
        }}
        PaperProps={{
          style: {
            display: "flex",
            flexDirection: "row",
            gap: 12,
            padding: "12px 20px",
            borderRadius: 16,
          },
        }}
      >
        {modes.map((m) => (
          <Tooltip title={m.label} key={m.key} placement="top">
            <MenuButton
              active={mode === m.key}
              onClick={() => {
                onChange(m.key);
                handleClose();
              }}
              aria-label={m.label}
            >
              {m.icon}
            </MenuButton>
          </Tooltip>
        ))}
      </Popover>
    </>
  );
};

export default ModeSwitch;
