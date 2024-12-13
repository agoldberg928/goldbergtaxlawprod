import React from "react";
import styled from "@emotion/styled";
import { Box, LinearProgress, LinearProgressProps, Typography } from "@mui/material";

export function LinearProgressWithLabel(props: LinearProgressProps & { value: number, description: string }) {
    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ width: '100%', mr: 1 }}>
                <LinearProgress variant="determinate" {...props} />
                </Box>
                <Box sx={{ minWidth: 35 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {`${Math.round(props.value)}%`}
                </Typography>
                </Box>
            </Box>
            <Box>
                {props.description}...
            </Box>
        </>
    );
}

export const VisuallyHiddenInput = styled('input')({
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    whiteSpace: 'nowrap',
    width: 1,
});