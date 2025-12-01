import React, { useState } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";

interface ImageCardProps {
  src: string;
  alt?: string;
  onClick?: () => void;
  info?: React.ReactNode;
  sx?: object;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  // Optional aspect ratio for the image area. Examples: 1 (square), '16 / 9'
  ratio?: number | string;
  // Feedback handlers
  onFeedback?: (feedbackType: 'positive' | 'negative') => void;
  feedbackStatus?: 'positive' | 'negative' | null;
  // Show feedback buttons
  showFeedback?: boolean;
}

const ImageCard: React.FC<ImageCardProps> = ({
  src,
  alt,
  onClick,
  info,
  sx = {},
  style = {},
  children,
  ratio,
  onFeedback,
  feedbackStatus = null,
  showFeedback = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleFeedbackClick = (e: React.MouseEvent, action: 'positive' | 'negative') => {
    e.stopPropagation(); // Prevent triggering parent onClick
    if (onFeedback) {
      onFeedback(action);
    }
  };

  // Determine border color based on feedback status
  const getBorderStyle = () => {
    if (feedbackStatus === 'positive') {
      return { border: '3px solid #4caf50', boxShadow: '0 0 8px rgba(76, 175, 80, 0.5)' };
    }
    if (feedbackStatus === 'negative') {
      return { border: '3px solid #f44336', boxShadow: '0 0 8px rgba(244, 67, 54, 0.5)' };
    }
    return {};
  };

  return (
    <Box
      sx={{
        borderRadius: 2,
        boxShadow: 2,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.15s, box-shadow 0.15s, border 0.15s",
        "&:hover": onClick ? { transform: "scale(1.1)", boxShadow: 4 } : {},
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        ...getBorderStyle(),
        ...sx,
      }}
      style={style}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {ratio ? (
        // Image area with fixed aspect ratio
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: typeof ratio === "number" ? `${ratio} / 1` : (ratio as string),
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <img
            src={src}
            alt={alt}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          
          {/* Feedback buttons overlay */}
          {showFeedback && isHovered && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                opacity: 1,
                transition: "opacity 0.2s",
              }}
            >
              <IconButton
                onClick={(e) => handleFeedbackClick(e, 'positive')}
                sx={{
                  backgroundColor: feedbackStatus === 'positive' ? "#4caf50" : "rgba(255, 255, 255, 0.9)",
                  color: feedbackStatus === 'positive' ? "white" : "inherit",
                  "&:hover": {
                    backgroundColor: "#4caf50",
                    color: "white",
                  },
                }}
                size="medium"
              >
                <ThumbUpIcon />
              </IconButton>
              <IconButton
                onClick={(e) => handleFeedbackClick(e, 'negative')}
                sx={{
                  backgroundColor: feedbackStatus === 'negative' ? "#f44336" : "rgba(255, 255, 255, 0.9)",
                  color: feedbackStatus === 'negative' ? "white" : "inherit",
                  "&:hover": {
                    backgroundColor: "#f44336",
                    color: "white",
                  },
                }}
                size="medium"
              >
                <ThumbDownIcon />
              </IconButton>
            </Box>
          )}
        </Box>
      ) : (
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 8,
          }}
        />
      )}
      {info && (
        <Typography variant="body2" color="text.secondary" noWrap>
          {info}
        </Typography>
      )}
      {children}
    </Box>
  );
};

export default ImageCard;
