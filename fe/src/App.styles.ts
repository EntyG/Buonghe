import styled from "styled-components";
import IconButton from "@mui/material/IconButton";

export const Layout = styled.div`
  display: flex;
  min-height: 100vh;
  background: ${({ theme }) => theme.bg || "#fff"};
`;

export const Sidebar = styled.div`
  left: 0;
  top: 0;
  height: 100vh;
  width: 64px;
  background: #000;
  border-right: 1.5px solid #222;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 16px;
  z-index: 100;
`;

export const LeftPanel = styled.div`
  width: 380px;
  min-width: 280px;
  max-width: 420px;
  height: 100vh;
  overflow-y: hidden;
  background: ${({ theme }) => theme.surface || "#f8f9fa"};
  border-right: 1.5px solid #222;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding-left: 0px; /* space for sidebar */
  padding-top: 0px;
  @media (max-width: 900px) {
    width: 100vw;
    max-width: 100vw;
    min-width: 0;
    border-right: none;
    padding-left: 64px;
  }
`;

export const ChatBox = styled.div`
  background: ${({ theme }) => theme.surface || "#fff"};
  border-radius: 16px;
  margin: 16px 24px 0 24px;
  padding: 16px;
  min-height: 120px;
  box-shadow: 0 2px 8px #0001;
  color: ${({ theme }) => theme.text || "#222"};
  font-size: 1rem;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const RightPanel = styled.div`
  flex: 1;
  height: 100vh;
  overflow-y: auto;
  padding: 0px 0px 16px 0px;
  background: ${({ theme }) => theme.bg || '#fff'};
  @media (max-width: 900px) {
    padding: 0px 4vw 32px 4vw;
  }
`;

export const RightSidebar = styled.div`
  width: 400px;
  min-width: 320px;
  max-width: 450px;
  height: 100vh;
  overflow-y: hidden;
  background: ${({ theme }) => theme.surface || "#f8f9fa"};
  border-left: 1.5px solid #222;
  display: flex;
  flex-direction: column;
  @media (max-width: 1200px) {
    display: none;
  }
`;

export const TopBar = styled.div`
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: ${({ theme }) => theme.bg || '#fff'};
  padding: 8px 8px 8px 8px;
  border-bottom: 1px solid rgba(0,0,0,0.1);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

export const ThemeSwitchBtn = styled(IconButton)`
  && {
    margin-top: 16px;
    color: #fff;
    background: #222;
    border: 1.5px solid #444;
    width: 44px;
    height: 44px;
    &:hover {
  background: ${({ theme }) => theme.red};
      color: #fff;
    }
  }
`;
