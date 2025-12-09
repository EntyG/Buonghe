import { createTheme } from "@mui/material/styles";

export const mainColors = {
  red: "#be0d00",
  black: "#000000",
  white: "#ffffff",
  text: "#1a1a1a",
  buttonBg: "#ffffff",
  bg: "#f5f5f5",
  surface: "#ffffff",
  surfaceAlt: "#e8e8e8",
  border: "#ddd",
};

export const darkColors = {
  red: "#ec5151",
  black: "#000000",
  white: "#ffffff",
  bg: "#1a1a1a",
  surface: "#2a2a2a",
  surfaceAlt: "#3a3a3a",
  text: "#ffffff",
  buttonBg: "#2e3035",
  border: "#404040",
};

export const muiTheme = createTheme({
  palette: {
    primary: {
      main: mainColors.red,
      contrastText: mainColors.white,
    },
    secondary: {
      main: mainColors.black,
      contrastText: mainColors.white,
    },
    background: {
      default: mainColors.white,
      paper: mainColors.white,
    },
    text: {
      primary: mainColors.black,
      secondary: mainColors.red,
    },
  },
  typography: {
    fontFamily: "Roboto, Arial, sans-serif",
  },
});

export const muiDarkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: darkColors.red,
      contrastText: darkColors.white,
    },
    secondary: {
      main: darkColors.white,
      contrastText: darkColors.black,
    },
    background: {
      default: darkColors.bg,
      paper: darkColors.surface,
    },
    text: {
      primary: darkColors.text,
      secondary: darkColors.red,
    },
  },
  typography: {
    fontFamily: "Roboto, Arial, sans-serif",
  },
});
