import styled from "styled-components";
import { IconButton } from "@mui/material";

export const MainModeButton = styled(IconButton)<{ activecolor?: string }>`
  && {
    background: ${({ theme }) => theme.buttonBg || theme.white};
    color: ${({ activecolor, theme }) => activecolor || theme.red};
    border: 2px solid ${({ activecolor, theme }) => activecolor || theme.red};
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    transition: background 0.2s, color 0.2s;
    &:hover {
      background: ${({ activecolor, theme }) => activecolor || theme.red};
      color: #fff;
    }
  }
`;

export const MenuButton = styled(IconButton)<{ active?: boolean }>`
  && {
    background: ${({ active, theme }) => (active ? theme.red : (theme.buttonBg || theme.white))};
    color: ${({ active, theme }) => (active ? theme.white : theme.red)};
    border: 2px solid ${({ theme }) => theme.red};
    width: 44px;
    height: 44px;
    transition: background 0.2s, color 0.2s;
  box-shadow: ${({ active, theme }) => (active ? `0 0 0 2px ${theme.red}33` : "none")};
    &:hover {
      background: ${({ active, theme }) => (active ? theme.red : "#fff3f2")};
      color: ${({ theme }) => theme.red};
      border-color: ${({ theme }) => theme.red};
    }
  }
`;
