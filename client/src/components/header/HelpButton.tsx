import IconButton from "@mui/material/IconButton";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import Tooltip from "@mui/material/Tooltip";


export default function HelpButton() {
  const handleClick = () => {
    window.open("/src/assets/ClientIQ User Guide 7.15.26.pdf", "_blank", "width=1200,height=800,noopender,noreferrer");
  }

  return (
    <div
      style={{ position: 'relative', marginLeft: 'auto' }}
    >
      <Tooltip title="Help">
        <IconButton
          onClick={handleClick}
          aria-label="Help"
          size="medium"
          sx={{
            color: "#e8dcc8",
            "&:hover": {
              color: "#1a3d2b",
              backgroundColor: "rgba(26, 61, 43, 0.08)",
            },
          }}
        >
          <HelpOutlineIcon fontSize="medium" />
        </IconButton>
      </Tooltip>
    </div>
  )
}