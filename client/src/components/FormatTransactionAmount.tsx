import { Typography } from "@mui/material"
import { formatCurrency } from "@/helpers"

interface FormatTransactionAmountProps {
  amount: number;
}

export function FormatTransactionAmount({ amount }: FormatTransactionAmountProps) {
  return (
    <Typography
      variant="body2"
      sx={{
        color: amount > 0 ? 'success.main' : amount < 0 ? 'error.main' : 'text.primary',
        fontWeight: 500,
        fontFamily: 'Roboto Mono'
      }}
    >
      {amount > 0 ? '+' : amount < 0 ? '-' : ''}{formatCurrency(Math.abs(amount))}
    </Typography>
  )
}