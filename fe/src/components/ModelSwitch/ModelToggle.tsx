import React, { useState } from "react";
import { IconButton, Tooltip, Typography, Menu, MenuItem } from "@mui/material";
import { useTheme } from "styled-components";

type Props = {
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
};

const ModelToggle: React.FC<Props> = ({ value, options, onChange }) => {
  // State để quản lý việc đóng/mở menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const theme = useTheme();

  // Tìm model đang được chọn
  const currentOption = options.find(o => o.key === value) || options[0];

  // Hàm mở menu
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  // Hàm đóng menu
  const handleClose = () => {
    setAnchorEl(null);
  };

  // Hàm xử lý khi chọn một model từ menu
  const handleMenuItemClick = (key: string) => {
    onChange(key);
    handleClose();
  };

  return (
    <>
      <Tooltip title={`Model: ${currentOption.label} (Click to select)`} placement="right">
        <IconButton
          onClick={handleClick}
          size="medium"
          aria-controls={open ? 'model-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{
            border: '2px solid',
            borderColor: 'primary.main',
            width: 48,
            height: 48,
            marginBottom: '16px',
            bgcolor: theme.buttonBg || theme.white,
            color: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.main',
              color: '#fff'
            },
          }}
        >
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontWeight: 'bold',
              lineHeight: 1
            }}
          >
            {currentOption.label}
          </Typography>
        </IconButton>
      </Tooltip>
      <Menu
        id="model-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'toggle-model',
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.key}
            selected={option.key === value}
            onClick={() => handleMenuItemClick(option.key)}
            sx={{
              // In đậm model đang được chọn
              fontWeight: option.key === value ? 'bold' : 'normal',
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default ModelToggle;