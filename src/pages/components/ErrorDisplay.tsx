import { Clear } from '@mui/icons-material'
import { Alert, IconButton } from '@mui/material'
import { Box } from '@mui/system'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { removeError, replaceLineBreaksWithReactNode, selectAllErrors } from '../../data/errorsSlice'
import { AppDispatch } from '../../store'

export function ErrorDisplay() {
    const errors = useSelector(selectAllErrors)
    const dispatch = useDispatch<AppDispatch>()

    return (
        <Box>
            {errors.map((err) => 
                <Box key={err.id} className="fade-in-out">
                    <Alert severity="error">
                        {replaceLineBreaksWithReactNode(`[${err.time}] ${err.message}`)}
                        <IconButton sx={{border: "none"}} aria-label="remove" onClick={() => dispatch(removeError(err.id))}><Clear color='error' /></IconButton>
                    </Alert>
                </Box>
            )}
        </Box>
    )
}