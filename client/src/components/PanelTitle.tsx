import { Box, Typography } from "@mui/material";

export default function PanelTitle({ left, right }: { left: string, right?: React.ReactNode }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.75 }}>
            <Typography sx={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7a9a7a" }}>
                {left}
            </Typography>
            {right && <Box>{right}</Box>}
        </Box>
    )
}