import styled from "styled-components";
import { IconButton } from "@mui/material";

export const FeedbackButton = styled(IconButton)<{ active?: boolean; disabled?: boolean }>`
  && {
    background: ${({ active, disabled, theme }) => 
      disabled ? (theme.buttonBg || theme.white) : (active ? theme.red : (theme.buttonBg || theme.white))};
    color: ${({ active, disabled, theme }) => 
      disabled ? '#ccc' : (active ? theme.white : theme.red)};
    border: 2px solid ${({ disabled, theme }) => disabled ? '#ccc' : theme.red};
    width: 44px;
    height: 44px;
    margin-bottom: 16px;
    transition: background 0.2s, color 0.2s, opacity 0.2s;
    opacity: ${({ disabled }) => disabled ? 0.5 : 1};
    cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
    box-shadow: ${({ active, theme }) => (active ? `0 0 0 2px ${theme.red}33` : "none")};
    &:hover {
      background: ${({ disabled, theme }) => disabled ? (theme.buttonBg || theme.white) : theme.red};
      color: ${({ disabled, theme }) => disabled ? '#ccc' : theme.white};
      border-color: ${({ disabled, theme }) => disabled ? '#ccc' : theme.red};
    }
    &:disabled {
      pointer-events: none;
    }
  }
`;
