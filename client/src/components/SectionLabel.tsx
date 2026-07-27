import { Box, Typography } from "@mui/material";
import { formatFlatDate } from "@/helpers";

export default function SectionLabel({ asOfDate, children }: { asOfDate: string, children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25, }}>
      <Typography sx={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#517a5a" }}>
        {children}
      </Typography>
      <Box sx={{ flex: 1, height: "1px", background: "#c8d8c0" }} />
      {asOfDate && (
        <Typography sx={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.12em", color: "#517a5a" }}>
          Last Refresh: {formatFlatDate(asOfDate, 1)}
        </Typography>
      )}
    </Box>
  );
}