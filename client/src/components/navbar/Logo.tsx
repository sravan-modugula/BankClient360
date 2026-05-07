import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";


export default function Logo() {
  return (
    <>
      {/* Logo and Header */}
      <Box
        // onClick={handleHomeClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          pl: 0,
          px: 2,
          py: 1,
          borderRadius: 1,
          transition: 'background-color 0.15s, transform 0.15s',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            transform: 'scale(1.02)'
          }
        }}
        data-testid="button-home"
      >
        {/* SVG Network Logo */}
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Primary connection lines from center to corners */}
          <line x1="18" y1="18" x2="8" y2="8" stroke="#936b06" strokeWidth="1.5" opacity="0.6" />
          <line x1="18" y1="18" x2="28" y2="8" stroke="#936b06" strokeWidth="1.5" opacity="0.6" />
          <line x1="18" y1="18" x2="8" y2="28" stroke="#936b06" strokeWidth="1.5" opacity="0.6" />
          <line x1="18" y1="18" x2="28" y2="28" stroke="#936b06" strokeWidth="1.5" opacity="0.6" />

          {/* Connection lines from center to edge nodes */}
          <line x1="18" y1="18" x2="18" y2="6" stroke="#936b06" strokeWidth="1.5" opacity="0.5" />
          <line x1="18" y1="18" x2="30" y2="18" stroke="#936b06" strokeWidth="1.5" opacity="0.5" />
          <line x1="18" y1="18" x2="18" y2="30" stroke="#936b06" strokeWidth="1.5" opacity="0.5" />
          <line x1="18" y1="18" x2="6" y2="18" stroke="#936b06" strokeWidth="1.5" opacity="0.5" />

          {/* Outer ring connections (between corner nodes) */}
          <line x1="8" y1="8" x2="28" y2="8" stroke="#936b06" strokeWidth="1" opacity="0.3" />
          <line x1="28" y1="8" x2="28" y2="28" stroke="#936b06" strokeWidth="1" opacity="0.3" />
          <line x1="28" y1="28" x2="8" y2="28" stroke="#936b06" strokeWidth="1" opacity="0.3" />
          <line x1="8" y1="28" x2="8" y2="8" stroke="#936b06" strokeWidth="1" opacity="0.3" />

          {/* Corner nodes */}
          <circle cx="8" cy="8" r="3" fill="#FFFFFF" />
          <circle cx="28" cy="8" r="3" fill="#FFFFFF" />
          <circle cx="8" cy="28" r="3" fill="#FFFFFF" />
          <circle cx="28" cy="28" r="3" fill="#FFFFFF" />

          {/* Edge nodes (top, right, bottom, left) */}
          <circle cx="18" cy="6" r="2.5" fill="#FFFFFF" opacity="0.9" />
          <circle cx="30" cy="18" r="2.5" fill="#FFFFFF" opacity="0.9" />
          <circle cx="18" cy="30" r="2.5" fill="#FFFFFF" opacity="0.9" />
          <circle cx="6" cy="18" r="2.5" fill="#FFFFFF" opacity="0.9" />

          {/* Center node */}
          <circle cx="18" cy="18" r="4" fill="#b8945a" />
          <circle cx="18" cy="18" r="2.5" fill="#FFFFFF" />
        </svg>

        {/* Logo Text */}
        <Typography
          variant="h5"
          sx={{
            color: '#FFFFFF',
            fontWeight: 600,
            letterSpacing: '0.5px',
            fontSize: '1.4rem',
            fontFamily: '"Libre Baskerville", sans-serif'
          }}
        >
          Client<span style={{ color: '#b8945a' }}>IQ</span>
        </Typography>
      </Box>
    </>
  )
}