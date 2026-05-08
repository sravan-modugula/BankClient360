import { Button } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useLocation } from 'wouter';
import { smartBack } from '@/lib/navigation';

interface BackButtonProps {
  fallback: string | (() => void);
  label?: string;
  variant?: 'text' | 'outlined' | 'contained';
  size?: 'small' | 'medium' | 'large';
  testId?: string;
}

export default function BackButton({
  fallback,
  label = 'Back',
  variant = 'text',
  size = 'small',
  testId = 'button-back',
}: BackButtonProps) {
  const [, setLocation] = useLocation();
  return (
    <Button
      startIcon={<ArrowBack />}
      onClick={() => smartBack(setLocation, fallback)}
      variant={variant}
      size={size}
      data-testid={testId}
      sx={{ textTransform: 'none' }}
    >
      {label}
    </Button>
  );
}
