import { ChatState } from "../slices/chatSlice";

export const selectLastMessage = (state: { chat: ChatState }) => {
  const msgs = state.chat.messages;
  return msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
};
