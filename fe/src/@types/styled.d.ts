import "styled-components";

declare module "styled-components" {
  export interface DefaultTheme {
    red: string;
    black: string;
    white: string;
    bg?: string;
    surface?: string;
    text?: string;
    buttonBg?: string;
  }
}
