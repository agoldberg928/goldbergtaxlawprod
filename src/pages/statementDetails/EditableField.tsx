import React, { useState } from "react";
import { TextField, IconButton, Box, Typography } from "@mui/material";
import { Undo, Redo, Edit, Refresh } from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "../../store";
import { reportError } from "../../data/errorsSlice";
import { selectDetails, selectValueFromDetails, TransactionGridRecord, TransactionStatementDetails, updateDetails } from "../../data/transactionsSlice";
import { updateStatementFieldThunk } from "../../data/changeFunctions";

export type StringOrNumber = string | number | undefined;
type AllowedValueTypes = "string" | "number"; // Results in "string" | "number"

export interface EditableFieldProps {
    keyName: keyof TransactionStatementDetails;
    displayName?: string;
    type: AllowedValueTypes
    valueFormatter?: (value: StringOrNumber) => string;
    valueValidator?: (value: StringOrNumber) => void;
    // handleSubmit: (key: string, newValue: StringOrNumber) => void;
}

function convertValue(value: string, type: AllowedValueTypes): StringOrNumber {
    return type === "number" ? Number(value) : value
}

export function EditableField({ keyName, displayName, type, valueFormatter, valueValidator }: EditableFieldProps) {
    const dispatch = useDispatch<AppDispatch>()
    const value: StringOrNumber = useSelector(selectValueFromDetails(keyName));
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState<StringOrNumber>(value);
    const [originalValue, setOriginalValue] = useState<StringOrNumber>(value);
    const [history, setHistory] = useState<StringOrNumber[]>([value]);
    const [historyIndex, setHistoryIndex] = useState(0);

    function handleSubmit(value: StringOrNumber) {
        dispatch(updateStatementFieldThunk(keyName, value))
    }

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const convertedValue = convertValue(event.target.value, type)
            if (valueValidator) valueValidator(convertedValue)
            setInputValue(convertValue(event.target.value, type));
        } catch(error: any) {
            dispatch(reportError(error))
        }
    };

    const handleEditClick = () => {
        setIsEditing(true);
    };


    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            handleSubmit(inputValue);
            setIsEditing(false);

            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(inputValue);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setInputValue(history[historyIndex - 1]);
            handleSubmit(history[historyIndex - 1]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setInputValue(history[historyIndex + 1]);
            handleSubmit(history[historyIndex + 1]);
        }
    };

    const handleReset = () => {
        setInputValue(originalValue);
        setHistory([originalValue]);
        setHistoryIndex(0);
        handleSubmit(originalValue);
    };

    return (
        <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body1" sx={{ minWidth: 100 }}>{displayName ?? transformKeyName(keyName)}:</Typography>
            {isEditing ? (
                <TextField
                    type={type === "number" ? type : undefined}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    size="small"
                    onBlur={() => setIsEditing(false)}
                />
            ) : (
                <Typography onClick={handleEditClick} sx={{ cursor: "pointer" }}>
                    {valueFormatter ? valueFormatter(value) : value}
                </Typography>
            )}

            <IconButton size="small" onClick={handleUndo} disabled={historyIndex === 0}><Undo /></IconButton>
            <IconButton size="small" onClick={handleRedo} disabled={historyIndex === history.length - 1}><Redo /></IconButton>
            <IconButton size="small" onClick={handleReset} disabled={inputValue === originalValue}><Refresh /></IconButton>
            {!isEditing && <IconButton size="small" onClick={handleEditClick}><Edit /></IconButton>}
        </Box>
    );
}

function transformKeyName(keyName: string) {
    return keyName.addSpacesBeforeCapitalLetters().capitalize()
}