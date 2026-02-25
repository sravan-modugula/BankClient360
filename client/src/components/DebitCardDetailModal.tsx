import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Divider,
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  CreditCard as CreditCardIcon
} from '@mui/icons-material';
import {
  CARD_STATUS_COLORS,
  calculateUsagePercentage,
  getProgressBarColor,
  formatCardNumber,
  formatCardExpiry,
  getCardStatusLabel,
  getCardTypeConfig,
  getCardBrandConfig
} from '@/lib/debitCardConstants';
import type { DebitCardWithLimitProfile } from '@shared/schema';

interface DebitCardDetailModalProps {
  open: boolean;
  onClose: () => void;
  card: DebitCardWithLimitProfile | null;
  accountNumber?: string;
}

export default function DebitCardDetailModal({
  open,
  onClose,
  card,
  accountNumber
}: DebitCardDetailModalProps) {
  if (!card) return null;

  const cardBrand = getCardBrandConfig(card.cardBrand);
  const cardType = getCardTypeConfig(card.cardType);
  const statusConfig = CARD_STATUS_COLORS[card.cardStatus as keyof typeof CARD_STATUS_COLORS] 
    || CARD_STATUS_COLORS.active;

  // Render limit section without usage data (Phase 3 feature)
  const renderLimitSection = (
    title: string,
    limit: string | null,
    description?: string
  ) => {
    if (!limit) return null;

    const limitNum = parseFloat(limit);

    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="400">
              {title}
            </Typography>
            <Typography variant="h6" color="primary.main" fontWeight="500">
              ${limitNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </Box>

          {description && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              {description}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CreditCardIcon color="primary" />
            <Typography variant="h6" component="span">
              Debit Card Details
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Close dialog"
            data-testid="button-close-modal"
          >
            <CloseIcon />
          </IconButton>
        </Box>
        {accountNumber && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 5 }}>
            Account ****{accountNumber.slice(-4)}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        {/* Card Header */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'primary.light',
            borderRadius: 2,
            mb: 3,
            color: 'primary.contrastText'
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="overline" sx={{ opacity: 0.8 }}>
                Card Number
              </Typography>
              <Typography variant="h5" fontWeight="400" sx={{ fontFamily: 'monospace' }}>
                {formatCardNumber(card.lastFourDigits)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                <Chip
                  label={cardBrand.name}
                  size="small"
                  sx={{
                    bgcolor: 'white',
                    color: cardBrand.color,
                    fontWeight: 400
                  }}
                />
                <Chip
                  label={statusConfig.chip === 'default' ? card.cardStatus.toUpperCase() : getCardStatusLabel(card.cardStatus)}
                  size="small"
                  color={statusConfig.chip}
                />
                <Chip
                  label={cardType.label}
                  size="small"
                  sx={{
                    bgcolor: cardType.bg,
                    color: cardType.text,
                    fontWeight: 400
                  }}
                />
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="overline" sx={{ opacity: 0.8 }}>
                Cardholder
              </Typography>
              <Typography variant="body1" fontWeight="400">
                {card.cardholderName}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="overline" sx={{ opacity: 0.8 }}>
                Expires
              </Typography>
              <Typography variant="body1" fontWeight="400">
                {formatCardExpiry(card.expiryMonth, card.expiryYear)}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Limit Profile Section */}
        {card.limitProfile ? (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Spending Limits
                <Chip
                  label={card.limitProfile.profileName}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              </Typography>
              {card.limitProfile.profileDescription && (
                <Typography variant="body2" color="text.secondary">
                  {card.limitProfile.profileDescription}
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Daily Purchase Limit */}
            {renderLimitSection(
              'Daily Purchase Limit',
              card.limitProfile.dailyPurchaseLimit,
              'Maximum amount for purchases per day'
            )}

            {/* Daily ATM Limit */}
            {renderLimitSection(
              'Daily ATM Withdrawal Limit',
              card.limitProfile.dailyAtmLimit,
              'Maximum cash withdrawal per day'
            )}

            {/* Single Transaction Limit */}
            {renderLimitSection(
              'Single Transaction Limit',
              card.limitProfile.singleTransactionLimit,
              'Maximum amount per transaction'
            )}

            {/* Monthly Limit */}
            {renderLimitSection(
              'Monthly Spending Limit',
              card.limitProfile.monthlyLimit,
              'Total spending limit for current month'
            )}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No limit profile assigned to this card
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" data-testid="button-close-dialog">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
