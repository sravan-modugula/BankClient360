import SvgIcon from '@mui/material/SvgIcon';
import type { SvgIconProps } from '@mui/material/SvgIcon';

export default function PanelIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Outer rounded rectangle */}
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Vertical divider — runs from top border to bottom border */}
      <line
        x1="9"
        y1="5"
        x2="9"
        y2="19"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </SvgIcon>
  );
}