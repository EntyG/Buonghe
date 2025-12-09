import styled from "styled-components";
import IconButton from "@mui/material/IconButton";

// New Chatbot-based Layout
export const ChatbotLayout = styled.div`
  display: flex;
  min-height: 100vh;
  background: ${({ theme }) => theme.bg};
`;

// Left sidebar with Live2D Model
export const Live2DPanel = styled.div`
  width: 320px;
  min-width: 280px;
  max-width: 380px;
  height: 100vh;
  background: ${({ theme }) => theme.surface};
  border-right: 1px solid ${({ theme }) => theme.border || '#333'};
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  
  @media (max-width: 1200px) {
    width: 280px;
    min-width: 240px;
  }
  
  @media (max-width: 900px) {
    display: none;
  }
`;

export const Live2DContainer = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

export const CharacterInfo = styled.div`
  padding: 16px 20px;
  background: ${({ theme }) => theme.surfaceAlt || theme.surface};
  border-top: 1px solid ${({ theme }) => theme.border || '#333'};
  
  h3 {
    margin: 0 0 4px 0;
    font-size: 1.1rem;
    color: ${({ theme }) => theme.text};
    font-weight: 600;
  }
  
  p {
    margin: 0;
    font-size: 0.85rem;
    color: ${({ theme }) => theme.text}99;
  }
`;

export const MoodIndicator = styled.div<{ $mood?: string }>`
  position: absolute;
  top: 16px;
  left: 16px;
  padding: 6px 12px;
  background: ${({ theme }) => theme.surface}EE;
  backdrop-filter: blur(10px);
  border-radius: 20px;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.text};
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 10;
  border: 1px solid ${({ theme }) => theme.border || '#333'};
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $mood }) => {
      switch ($mood) {
        case 'happy': return '#4ade80';
        case 'excited': return '#facc15';
        case 'thinking': return '#60a5fa';
        case 'sad': return '#94a3b8';
        case 'surprised': return '#f472b6';
        default: return '#a78bfa';
      }
    }};
    animation: pulse 2s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

// Main Chat Panel (Center)
export const ChatPanel = styled.div`
  flex: 1;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.bg};
  position: relative;
`;

export const ChatHeader = styled.div`
  padding: 16px 32px;
  background: ${({ theme }) => theme.surface};
  border-bottom: 1px solid ${({ theme }) => theme.border || '#333'};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  z-index: 100;
`;

export const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: ${({ theme }) => theme.text};
  }
  
  span {
    font-size: 0.8rem;
    color: ${({ theme }) => theme.text}80;
    background: ${({ theme }) => theme.surfaceAlt || theme.bg};
    padding: 4px 10px;
    border-radius: 12px;
  }
`;

export const HeaderControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

// Messages Area
export const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => theme.red} transparent;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.red}50;
    border-radius: 3px;
    
    &:hover {
      background: ${({ theme }) => theme.red};
    }
  }
`;

export const MessageBubble = styled.div<{ $isUser?: boolean; $isBot?: boolean }>`
  max-width: 85%;
  align-self: ${({ $isUser }) => $isUser ? 'flex-end' : 'flex-start'};
  
  ${({ $isUser, $isBot, theme }) => $isUser ? `
    background: ${theme.red};
    color: #fff;
    border-radius: 20px 20px 4px 20px;
    padding: 12px 18px;
  ` : $isBot ? `
    background: ${theme.surface};
    color: ${theme.text};
    border-radius: 20px 20px 20px 4px;
    padding: 16px 20px;
  ` : ''}
`;

export const UserMessage = styled.div`
  max-width: 75%;
  align-self: flex-end;
  background: ${({ theme }) => theme.red};
  color: #fff;
  border-radius: 20px 20px 4px 20px;
  padding: 12px 18px;
  font-size: 0.95rem;
  line-height: 1.5;
  box-shadow: 0 2px 8px ${({ theme }) => theme.red}40;
`;

export const BotMessage = styled.div`
  max-width: 100%;
  align-self: flex-start;
`;

export const BotMessageContent = styled.div`
  width: 100%;
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  border-radius: 20px 20px 20px 4px;
  padding: 16px 20px;
  font-size: 0.95rem;
  line-height: 1.6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid ${({ theme }) => theme.border || '#333'};
  
  p {
    margin: 0 0 8px 0;
    &:last-child {
      margin-bottom: 0;
    }
  }
`;

export const BotAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, 
    ${({ theme }) => theme.red} 0%, 
    #f472b6 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  margin-bottom: 8px;
`;

export const MessageMeta = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.text}80;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const ResultsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  background: ${({ theme }) => theme.surfaceAlt || theme.bg}80;
  border-radius: 12px;
  
  @media (max-width: 1200px) {
    grid-template-columns: repeat(6, 1fr);
  }
  
  @media (max-width: 900px) {
    grid-template-columns: repeat(4, 1fr);
  }
  
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => theme.red}50 transparent;
`;

export const ResultImage = styled.div`
  position: relative;
  aspect-ratio: 16/9;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 6px 8px;
    background: linear-gradient(transparent, rgba(0,0,0,0.8));
    font-size: 0.7rem;
    color: #fff;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  &:hover .overlay {
    opacity: 1;
  }
`;

// Input Area
export const InputArea = styled.div`
  padding: 16px 32px 24px;
  background: ${({ theme }) => theme.surface};
  border-top: 1px solid ${({ theme }) => theme.border || '#333'};
`;

export const InputContainer = styled.form`
  display: flex;
  align-items: flex-end;
  gap: 12px;
  background: ${({ theme }) => theme.bg};
  border: 2px solid ${({ theme }) => theme.border || '#333'};
  border-radius: 24px;
  padding: 8px 8px 8px 20px;
  transition: border-color 0.2s, box-shadow 0.2s;
  
  &:focus-within {
    border-color: ${({ theme }) => theme.red};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.red}20;
  }
`;

export const ChatTextarea = styled.textarea`
  flex: 1;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.text};
  font-size: 1rem;
  line-height: 1.5;
  resize: none;
  min-height: 24px;
  max-height: 150px;
  padding: 8px 0;
  
  &:focus {
    outline: none;
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.text}60;
  }
`;

export const SendButtonStyled = styled.button<{ $disabled?: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: ${({ $disabled, theme }) => 
    $disabled 
      ? (theme.surfaceAlt || theme.surface) 
      : theme.red
  };
  color: #fff;
  cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
  flex-shrink: 0;
  
  &:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 12px ${({ theme }) => theme.red}40;
  }
  
  &:active:not(:disabled) {
    transform: scale(0.95);
  }
  
  svg {
    font-size: 1.25rem;
  }
`;

export const InputActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding-left: 8px;
`;

export const ActionButton = styled(IconButton)`
  && {
    color: ${({ theme }) => theme.text}80;
    padding: 8px;
    
    &:hover {
      color: ${({ theme }) => theme.red};
      background: ${({ theme }) => theme.red}15;
    }
  }
`;

// Quick Actions / Suggestions
export const QuickActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
`;

export const QuickActionChip = styled.button`
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  border: 1px solid ${({ theme }) => theme.border || '#333'};
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: ${({ theme }) => theme.red}20;
    border-color: ${({ theme }) => theme.red};
    color: ${({ theme }) => theme.red};
  }
`;

// Results Panel (Right side for expanded view)
export const ResultsPanel = styled.div<{ $expanded?: boolean }>`
  width: ${({ $expanded }) => $expanded ? '450px' : '0'};
  height: 100vh;
  background: ${({ theme }) => theme.surface};
  border-left: ${({ $expanded }) => $expanded ? '1px solid' : 'none'};
  border-color: ${({ theme }) => theme.border || '#333'};
  overflow: hidden;
  transition: width 0.3s ease;
  
  @media (max-width: 1400px) {
    position: fixed;
    right: 0;
    top: 0;
    z-index: 1000;
    box-shadow: ${({ $expanded }) => $expanded ? '-4px 0 20px rgba(0,0,0,0.3)' : 'none'};
  }
`;

export const ResultsPanelHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.border || '#333'};
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  h3 {
    margin: 0;
    font-size: 1rem;
    color: ${({ theme }) => theme.text};
  }
`;

export const ExpandedResultsGrid = styled.div`
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  overflow-y: auto;
  height: calc(100vh - 60px);
`;

// Typing Indicator
export const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  background: ${({ theme }) => theme.surface};
  border-radius: 20px;
  width: fit-content;
  border: 1px solid ${({ theme }) => theme.border || '#333'};
  
  span {
    width: 8px;
    height: 8px;
    background: ${({ theme }) => theme.text}60;
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out;
    
    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
  
  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-8px); }
  }
`;

// Welcome Screen
export const WelcomeScreen = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  
  h2 {
    font-size: 2rem;
    margin: 0 0 12px 0;
    color: ${({ theme }) => theme.text};
    font-weight: 600;
  }
  
  p {
    font-size: 1rem;
    color: ${({ theme }) => theme.text}80;
    max-width: 500px;
    line-height: 1.6;
    margin: 0 0 32px 0;
  }
`;

export const WelcomeIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${({ theme }) => theme.red};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  margin-bottom: 24px;
  box-shadow: 0 8px 32px ${({ theme }) => theme.red}40;
`;

// Cluster group in chat
export const ClusterGroup = styled.div`
  margin-top: 12px;
  
  h4 {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.text}80;
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
`;

// Responsive adjustments
export const MobileMenuButton = styled(IconButton)`
  && {
    display: none;
    
    @media (max-width: 900px) {
      display: flex;
    }
  }
`;
