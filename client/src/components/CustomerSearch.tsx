import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { CustomerListItem, SmartSearchResult, UnifiedSearchResult, SearchEntityItem } from '@shared/schema';
import {
  AppBar,
  Toolbar,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Fade,
  CircularProgress,
  Divider,
  ListSubheader
} from '@mui/material';
import { Search as SearchIcon, FilterList, Person, Groups } from '@mui/icons-material';
import { generateCustomerUrl, navigateToCustomer } from '@/lib/navigation';

interface Customer {
  id: string;
  customerId: number;
  name: string;
  accountNumber: string;
  riskRating: string;
  status: string;
}


export default function CustomerSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [, setLocation] = useLocation();

  // Debounce search query (250ms delay for better UX with short CIF/ID searches)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Smart API search using TanStack Query with unified search (customers + households)
  const searchUrl = `/api/customers/search?q=${encodeURIComponent(debouncedQuery)}&entityTypes=customer,household&limit=15`;

  const { data: unifiedResults, isLoading: searchLoading } = useQuery({
    queryKey: [searchUrl],
    enabled: debouncedQuery.length > 2,
    select: (data: UnifiedSearchResult) => data
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setShowResults(query.length > 2);
  };

  const handleEntitySelect = (entity: SearchEntityItem) => {
    if (entity.entityType === 'customer') {
      const customer: Customer = {
        id: entity.entityId.toString(),
        customerId: entity.entityId,
        name: entity.displayName,
        accountNumber: entity.customer?.silverlakeCustomerId || 'N/A',
        riskRating: 'medium',
        status: entity.status || 'active'
      };
      console.log('Customer selected:', customer);
      setSearchQuery("");
      setShowResults(false);
      setLocation(generateCustomerUrl(customer.customerId || customer.id));
    } else if (entity.entityType === 'household') {
      // Navigate to household page
      console.log('Household selected:', entity);
      setSearchQuery("");
      setShowResults(false);
      // setLocation(`/household/${entity.entityId}`);
      setLocation(`/ciq/household?householdId=${entity.entityId}`)
    }
  };

  // Group results by entity type
  const groupedResults = unifiedResults?.data.reduce((acc, entity) => {
    if (!acc[entity.entityType]) {
      acc[entity.entityType] = [];
    }
    acc[entity.entityType].push(entity);
    return acc;
  }, {} as Record<string, SearchEntityItem[]>) || {};

  const customerResults = groupedResults.customer || [];
  const householdResults = groupedResults.household || [];

  return (
    <>
      <TextField
        sx={{ 
          width: 400, 
          mt: 1, 
          mb: 1, 
          ml: "auto" // push search bar to right
        }}
        variant="outlined"
        placeholder="Search"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        data-testid="input-customer-search"
        slotProps={{
          input: {
            sx: {
              backgroundColor: "#ffffff",
              fontSize: 14,
              '& fieldset': { border: "none"},
            },
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="secondary" />
              </InputAdornment>
            ),
            size: "small"
          }
        }}
      />

      <Fade in={showResults}>
        <Paper
          elevation={8}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: 400,
            overflow: 'auto',
            width: 400,
            ml: "auto",
            mr: 3 // this is to match padding in the Header.tsx component
          }}
        >
          <List>
            {searchLoading ? (
              <ListItem>
                <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', py: 2 }}>
                  <CircularProgress size={24} />
                  <Typography sx={{ ml: 2 }}>Searching...</Typography>
                </Box>
              </ListItem>
            ) : unifiedResults && unifiedResults.data.length > 0 ? (
              <>
                {/* Customer Results Section */}
                {customerResults.length > 0 && (
                  <>
                    <ListSubheader sx={{ bgcolor: 'background.paper', fontWeight: 600, py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person fontSize="small" />
                        <Typography variant="subtitle2">CUSTOMERS ({customerResults.length})</Typography>
                      </Box>
                    </ListSubheader>
                    {customerResults.map((entity) => (
                      <ListItem
                        key={`customer-${entity.entityId}`}
                        component="button"
                        onClick={() => handleEntitySelect(entity)}
                        data-testid={`customer-result-${entity.entityId}`}
                        sx={{ cursor: 'pointer' }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.light' }}>
                            <Person />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={entity.displayName}
                          secondary={entity.primaryIdentifiers.join(' • ')}
                        />
                        <Chip
                          label={entity.status?.toUpperCase() || 'ACTIVE'}
                          variant="outlined"
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </>
                )}

                {/* Divider between sections */}
                {customerResults.length > 0 && householdResults.length > 0 && (
                  <Divider />
                )}

                {/* Household Results Section */}
                {householdResults.length > 0 && (
                  <>
                    <ListSubheader sx={{ bgcolor: 'background.paper', fontWeight: 600, py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Groups fontSize="small" />
                        <Typography variant="subtitle2">HOUSEHOLDS ({householdResults.length})</Typography>
                      </Box>
                    </ListSubheader>
                    {householdResults.map((entity) => (
                      <ListItem
                        key={`household-${entity.entityId}`}
                        component="button"
                        onClick={() => handleEntitySelect(entity)}
                        data-testid={`household-result-${entity.entityId}`}
                        sx={{ cursor: 'pointer' }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'secondary.light' }}>
                            <Groups />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={entity.displayName}
                          secondary={entity.primaryIdentifiers.join(' • ')}
                        />
                        <Chip
                          label={entity.status?.toUpperCase() || 'ACTIVE'}
                          variant="outlined"
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </>
                )}
              </>
            ) : (
              <ListItem>
                <ListItemText
                  primary="No results found"
                  secondary={searchQuery.length > 2 ? `No results for "${searchQuery}"` : 'Start typing to search customers and households...'}
                />
              </ListItem>
            )}
          </List>
        </Paper>
      </Fade>
    </>
  );
}