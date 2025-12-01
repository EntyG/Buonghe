import IconButton from "@mui/material/IconButton";
import styled from "styled-components";

export const StyledBtn = styled(IconButton)<{ activecolor?: string }>`
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
