import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PeopleIcon from '@mui/icons-material/People';

interface IconProps {
  sx: any;
}

export interface ProjectSubroute {
  name: string;
  shorthand?: string;
  route: string;
  hidden: boolean;
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
      { name: "Household", route: "/household", hidden: false },
      { name: "Client",    route: "/client",    hidden: false },
      { name: "Accounts",  route: "/accounts" , hidden: false },
    ],
  },
  // only include this in dev and test environment for now
  ...((
    window.location.href.includes("dev") || 
    window.location.href.includes("test") ||
    window.location.href.includes("localhost")
  ) ? [{ 
    name: "Relationship Based Review", 
    shorthand: "RBR",
    route: "/rbr",
    disableRouting: false, 
    icon: ({ sx } : any) => (
        <PeopleIcon 
        fontSize="small" 
        sx={{ color: 'text.secondary', flexShrink: 0, ...sx }} 
      />
    ), 
    subroutes: []
  }] : [])
];
