import React from "react";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { StyledBtn } from "./ThemeSwitch.styles";

type Props = {
  dark: boolean;
  onClick: () => void;
};

const ThemeSwitchBtn: React.FC<Props> = ({ dark, onClick }) => (
  <StyledBtn onClick={onClick} title="Switch theme">
    {dark ? <Brightness7Icon /> : <Brightness4Icon />}
  </StyledBtn>
);

export default ThemeSwitchBtn;

