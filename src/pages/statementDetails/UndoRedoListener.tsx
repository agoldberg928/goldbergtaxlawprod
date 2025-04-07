import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { redoTransactionThunk, undoTransactionThunk } from "../../data/changeFunctions";
import { AppDispatch } from "../../store";

export function UndoRedoListener() {
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            const isCtrlOrCmd = event.ctrlKey || event.metaKey;
            const isShift = event.shiftKey;
            const isZ = event.key.toLowerCase() === "z";

            // Ignore if user is typing in an input or textarea
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
                return;
            }

            if (isCtrlOrCmd && isZ) {
                event.preventDefault(); // Prevent browser's default behavior
                if (isShift) {
                    console.log("redo detected");
                    dispatch(redoTransactionThunk);
                } else {
                    console.log("undo detected");
                    dispatch(undoTransactionThunk);
                }
            }
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [dispatch]);

    return null; // This component doesn't render anything
}