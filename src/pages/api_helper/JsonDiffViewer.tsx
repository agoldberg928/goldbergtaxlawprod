import React, { useState } from "react";
import { Box, Button, ToggleButton, ToggleButtonGroup } from "@mui/material";
import DiffViewer from "react-diff-viewer-continued";

export interface JsonDiffViewerProps {
    originalData: string,
    newData: string
}

export function JsonDiffViewer({ originalData, newData }: JsonDiffViewerProps) {
  const [view, setView] = useState("split");

  const handleViewChange = (event: any, newView: string) => {
    if (newView) setView(newView);
  };

  return (
    <Box>
      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={handleViewChange}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="split">Split View</ToggleButton>
        <ToggleButton value="inline">Inline View</ToggleButton>
      </ToggleButtonGroup>
      
      <DiffViewer
        oldValue={originalData}
        newValue={newData}
        splitView={view === "split"}
        useDarkTheme={false}
      />
    </Box>
  );
};

export default JsonDiffViewer;