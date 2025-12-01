import { createTheme } from "@mui/material/styles";

export const mainColors = {
  red: "#be0d00",
  black: "#000000",
  white: "#ffffff",
  text: "#000000",
  buttonBg: "#ffffff",
};

export const darkColors = {
  red: "#ec5151ff",
  black: "#000000",
  white: "#ffffff",
  bg: "#363738ff",
  surface: "#313536ff",
  text: "#fff",
  buttonBg: "#2e3035ff",
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
