import "styled-components";

declare module "styled-components" {
  export interface DefaultTheme {
    red: string;
    black: string;
    white: string;
    bg?: string;
    surface?: string;
    surfaceAlt?: string;
    text?: string;
    buttonBg?: string;
    border?: string;
  }
}
