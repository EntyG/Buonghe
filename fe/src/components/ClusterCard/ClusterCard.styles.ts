import styled from "styled-components";
import { Card, Box } from "@mui/material";

export const StyledCard = styled(Card)`
  margin: 16px 0;
  border-radius: 16px;
  box-shadow: 0 2px 12px #0002;
  background: #fff;
`;

export const ImagesRow = styled(Box)`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  margin-top: 8px;
  width: 100%;
  max-width: 100%;
  max-height: 90px;
  padding-bottom: 8px;
  box-sizing: border-box;
`;

export const ImageThumb = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid #eee;
`;
