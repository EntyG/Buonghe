import React, { useState } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import CssBaseline from "@mui/material/CssBaseline";
import { muiTheme, mainColors, muiDarkTheme, darkColors } from "./theme";
import ChatbotView from "./components/ChatbotView/ChatbotView";

const App: React.FC = () => {
  const [dark, setDark] = useState(true);

  const theme = dark ? muiDarkTheme : muiTheme;
  const styledTheme = dark ? darkColors : mainColors;

  return (
    <MuiThemeProvider theme={theme}>
      <StyledThemeProvider theme={styledTheme}>
        <CssBaseline />
        <ChatbotView
          dark={dark}
          onToggleTheme={() => setDark((d) => !d)}
        />
      </StyledThemeProvider>
    </MuiThemeProvider>
  );
};

export default App;
