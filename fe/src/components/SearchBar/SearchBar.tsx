import React from "react";
import { InputBase, IconButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { BarWrapper } from "./SearchBar.styles";

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSearch: () => void;
}

const SearchBar: React.FC<Props> = ({ value, onChange, onSearch }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSearch();
  };
  return (
    <BarWrapper>
      <InputBase
        sx={{ ml: 2, flex: 1 }}
        placeholder="Nhập nội dung tìm kiếm..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        inputProps={{ "aria-label": "search" }}
      />
      <IconButton onClick={onSearch} aria-label="search">
        <SearchIcon />
      </IconButton>
    </BarWrapper>
  );
};

export default SearchBar;
