import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

interface IconProps {
  sx: any;
}

export interface ProjectSubroute {
  name: string;
  shorthand?: string;
  route: string;
}

export interface Project {
  name: string;
  shorthand: string;
  route: string;
  disableRouting: boolean;
  icon: React.FC<IconProps>;
  subroutes: ProjectSubroute[];
}

export const PROJECTS: Project[] = [
  {
    name: "ClientIQ",
    shorthand: "ClientIQ",
    route: "/ciq",
    disableRouting: true,
    icon: ({ sx }) => (
      <AccountCircleIcon 
        fontSize="small" 
        sx={{ color: 'text.secondary', flexShrink: 0, ...sx }} 
      />
    ),
    subroutes: [
      { name: "Client",        route: "/client"  },
      { name: "Household",  route: "/household"  },
      { name: "Accounts",  route: "/accounts"    },
    ],
  },
];