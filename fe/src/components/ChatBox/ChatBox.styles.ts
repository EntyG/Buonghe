import styled from "styled-components";

export const ChatContainer = styled.div`
  background: ${({ theme }) => theme.surface || "#fff"};
  border-radius: 16px;
  margin: 0 16px 16px 16px;
  padding: 16px;
  box-shadow: 0 2px 8px #0001;
  color: ${({ theme }) => theme.text || "#222"};
  font-size: 1rem;
  display: flex;
  flex-direction: column;
  flex: 1;
  height: calc(100vh - 80px);
  min-height: 0;
  
  /* CSS variables for message styling */
  --message-bg: ${({ theme }) => theme.surface ? '#3a3b3c' : '#f8f9fa'};
  --message-text: ${({ theme }) => theme.text || '#222'};
  --message-meta: ${({ theme }) => theme.surface ? '#9ca3af' : '#6c757d'};
  --message-warning: ${({ theme }) => theme.red};
  --label-text: ${({ theme }) => theme.red};
`;

export const MessagesList = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => theme.red} #eee;
  &::-webkit-scrollbar {
    width: 8px;
    background: #eee;
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
  background: ${({ theme }) => theme.red};
    border-radius: 8px;
  }
  max-height: calc(100% - 0px);
`;

export const InputRow = styled.form`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
`;

export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const TextareaWrapper = styled.div`
  background: ${({ theme }) => theme.surface ? '#2c2d30' : '#f8f9fa'};
  border-radius: 12px;
  padding: 6px 6px; /* smaller vertical padding so background can touch top */
  border: 2px solid ${({ theme }) => theme.surface ? '#404248' : '#e9ecef'};
  transition: border-color 0.2s;
  
  &:focus-within {
  border-color: ${({ theme }) => theme.red};
  }
`;

export const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
`;

export const Input = styled.textarea`
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.text || "#222"};
  font-size: 1rem;
  resize: none;
  min-height: 20px; /* visually single-line start */
  max-height: 220px;
  overflow-y: auto;
  font-family: inherit;
  line-height: 1.4;
  
  &:focus {
    outline: none;
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.surface ? '#9ca3af' : '#6c757d'};
  }
  
  /* Auto-resize scrollbar */
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => theme.red} #eee;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 2px;
  }
  
  &::-webkit-scrollbar-thumb {
  background: ${({ theme }) => theme.red};
    border-radius: 2px;
  }
`;

export const SendButton = styled.button`
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: ${({ theme }) => theme.red};
  color: #fff;
  font-weight: bold;
  cursor: pointer;
  white-space: nowrap;
  min-height: 36px;
  transition: background-color 0.2s;
  
  &:hover:not(:disabled) {
  background: ${({ theme }) => theme.red};
  }
  
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

export const CharCounter = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.surface ? '#9ca3af' : '#6c757d'};
  text-align: right;
  padding: 2px 4px;
`;

export const SuggestionList = styled.ul`
  margin: 4px 0 8px 24px;
  padding: 0;
  list-style: disc;
  color: ${({ theme }) => theme.surface ? '#9ca3af' : '#888'};
  font-size: 0.95em;
`;
