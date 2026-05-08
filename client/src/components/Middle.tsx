/*
    This is a placeholder component. It is going to be used as a temporary
    place to house middle cards because they share state. Eventually we will
    want to refactor the API so that less calls are used. 
*/
import {
    Box,
    Typography,
    Card,
    CardContent,
    useTheme
} from "@mui/material";
import {
    TrendingUp,
    TrendingDown,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import PanelTitle from "./PanelTitle";
import type { ClientEngagementDTO } from '@shared/contracts';
import type { RelationshipSummaryDTO } from '@shared/contracts';
import type { ContactHistoryDTO } from '@shared/contracts';
import { formatCurrency, formatRelativeDate } from "@/helpers";

interface MiddleProps {
    customerId: number;
}

interface KPICardProps {
    label: string;
    value: string;
    sub: React.ReactElement;
    accent: string;
    smallValue: boolean;
}

function KPICard({ label, value, sub, accent, smallValue }: KPICardProps) {
    return (
        <Card key={label} elevation={0} sx={{ widht: "100%", border: "1px solid #d0ddc8", borderRadius: 2.5, borderTop: `2px solid ${accent}` }}>
            <CardContent sx={{ p: "14px 16px !important" }}>
                <PanelTitle left={label} />
                <Typography sx={{ fontSize: smallValue ? 14 : 26, fontWeight: 200, color: "#1a2e1a", lineHeight: 1, mb: 0.5 }}>
                    {value}
                </Typography>
                {sub}
            </CardContent>
        </Card>
    )
}

export default function Middle({ customerId }: MiddleProps) {

    const theme = useTheme();

    // Get the data for client engagement
    const {
        data: engagement,
    } = useQuery<ClientEngagementDTO>({
        queryKey: [`/api/customers/${customerId}/client-engagement`],
        enabled: !!customerId
    });

    const {
        data: summary,
    } = useQuery<RelationshipSummaryDTO>({
        queryKey: [`/api/customers/${customerId}/relationship-summary`],
        enabled: !!customerId
    });

    const {
        data: contactHistory,
    } = useQuery<ContactHistoryDTO>({
        queryKey: [`/api/customers/${customerId}/contact-history`],
        enabled: !!customerId
    });

    const contacts = (contactHistory?.recentContacts || []);

    const formatChange = (amount: number, percent: number) => {
        const isPositive = amount >= 0;
        const TrendIcon = isPositive ? TrendingUp : TrendingDown;
        const color = isPositive ? theme.palette.primary.main : theme.palette.primary.main;

        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontSize: 14 }}>
                    QoQ Change:
                </Typography>
                <TrendIcon sx={{ fontSize: 16, color }} />
                <Typography variant="caption" sx={{ color, fontSize: 14 }} data-testid="text-quarter-change">
                    {isPositive ? '+' : ''}{formatCurrency(amount)} ({isPositive ? '+' : ''}{percent.toFixed(1)}%)
                </Typography>
            </Box>
        );
    };


    return (
        <Box sx={{ display: 'flex', gap: 3, width: "100%" }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.5, mb: 2, width: "100%" }}>
                <KPICard
                    label="Total Deposits"
                    value={formatCurrency(summary?.totalDeposits || 0)}
                    sub={
                        formatChange(summary?.depositsQoQ?.amountChange || 0, summary?.depositsQoQ?.percentChange || 0)
                    }
                    accent="#2d6a2d"
                    smallValue={false}
                />
                <KPICard
                    label="Total Loans"
                    value={formatCurrency(summary?.totalLoans || 0)}
                    sub={
                        formatChange(summary?.loansQoQ?.amountChange || 0, summary?.loansQoQ?.percentChange || 0)
                    }
                    accent="#8a6a2a"
                    smallValue={false}
                />
                <KPICard
                    label="Last Login"
                    value={engagement?.lastLoginAt || 'Never'}
                    sub={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {/*<Typography variant="caption" sx={{ fontSize: 14 }}>
                                Login ID:
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: 14 }} data-testid="text-quarter-change">
                                {engagement?.loginId || "N/A"}
                            </Typography>*/}
                        </Box>
                    }
                    accent="#2d6a2d"
                    smallValue={false}
                />
                <KPICard
                    label="Recent Contacts"
                    value={String(contacts.length)}
                    sub={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ fontSize: 14 }}>
                                Last Contact:
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: 14 }} data-testid="text-quarter-change">
                                {contacts.length > 0 ? formatRelativeDate(contacts[0].occurredAt) : 'None'}
                            </Typography>
                        </Box>      
                    }
                    accent="#8a6a2a"
                    smallValue={false}
                />
            </Box>
        </Box>
    )
}