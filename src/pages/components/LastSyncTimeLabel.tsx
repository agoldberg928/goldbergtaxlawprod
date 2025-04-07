import { Cached } from '@mui/icons-material'
import { Button, Chip } from '@mui/material'
import React from 'react'

export function LastSyncTimeLabel({lastSyncTime, handleClick: onClick, loading}: LastSyncTimeLabelProps) {
    return (
        <>
            <Chip sx={{ml: 1}} size="small" color={getLastSyncColor(lastSyncTime)} label={`Last Synced: ${lastSyncTime?.toLocaleString()}`} />
            <Button className={loading ? 'loading' : ''}size='small' sx={{minWidth:40}} onClick={onClick}><Cached/></Button>
        </>
    )
}

interface LastSyncTimeLabelProps {
    lastSyncTime: Date | null,
    handleClick: () => void
    loading?: boolean
}

function getLastSyncColor(lastSyncTime: Date | null): "success" | "warning" | "error" {
    if (lastSyncTime == null) return "error"
    const hoursSinceSync = (new Date().getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60)
    let lastSyncColor: "success" | "warning" | "error"
    if (hoursSinceSync < 24) lastSyncColor = "success"
    else if (hoursSinceSync < 24 * 7) lastSyncColor = "warning"
    else lastSyncColor = "error"
    return lastSyncColor
}