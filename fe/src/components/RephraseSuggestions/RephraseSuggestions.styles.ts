import styled from "styled-components";

export const SuggestionList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 8px 0 16px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
`;

export const SuggestionItem = styled.li`
  background: #fff3f2;
  color: ${({ theme }) => theme.red};
  border-radius: 16px;
  padding: 6px 16px;
  font-size: 0.95rem;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.red};
  transition: background 0.2s, color 0.2s;
  &:hover {
  background: ${({ theme }) => theme.red};
    color: #fff;
  }
`;
