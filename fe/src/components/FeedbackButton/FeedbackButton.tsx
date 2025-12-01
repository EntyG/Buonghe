import React from "react";
import { Tooltip, Badge } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { FeedbackButton as StyledFeedbackButton } from "./FeedbackButton.styles";

interface FeedbackButtonProps {
  feedbackCount: number;
  disabled?: boolean;
  onClick: () => void;
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  feedbackCount,
  disabled = false,
  onClick,
}) => {
  const isActive = feedbackCount > 0;

  return (
    <Tooltip
      title={
        disabled 
          ? "Perform a search first" 
          : isActive 
          ? `Send ${feedbackCount} feedback${feedbackCount > 1 ? 's' : ''}` 
          : "Select images to provide feedback"
      }
      placement="right"
      arrow
    >
      <span>
        <Badge 
          badgeContent={feedbackCount} 
          color="error"
          invisible={feedbackCount === 0}
        >
          <StyledFeedbackButton
            active={isActive}
            disabled={disabled || !isActive}
            onClick={onClick}
            aria-label="send feedback"
          >
            <SendIcon />
          </StyledFeedbackButton>
        </Badge>
      </span>
    </Tooltip>
  );
};

export default FeedbackButton;
