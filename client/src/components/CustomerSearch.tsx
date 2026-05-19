import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { UnifiedSearchResult, SearchEntityItem } from '@shared/schema';
import { TextField, InputAdornment, Fade, CircularProgress } from '@mui/material';
import { Search as SearchIcon, Person, Groups, Close, AccountBalance } from '@mui/icons-material';
import { generateCustomerUrl } from '@/lib/navigation';

interface Customer {
  id: string;
  customerId: number;
  name: string;
  accountNumber: string;
  riskRating: string;
  status: string;
}

type SectionKey = 'customer' | 'account' | 'household';

const SECTION_ORDER: SectionKey[] = ['customer', 'account', 'household'];

const SECTION_CONFIG = {
  customer: {
    label: 'Clients',
    icon: Person,
    avatarBg: '#E6F1FB',
    avatarColor: '#0C447C',
    iconBg: '#E6F1FB',
    iconColor: '#0C447C',
  },
  account: {
    label: 'Accounts',
    icon: AccountBalance,
    iconBg: '#FAEEDA',
    iconColor: '#854F0B',
  },
  household: {
    label: 'Households',
    icon: Groups,
    iconBg: '#E1F5EE',
    iconColor: '#085041',
  },
};

function highlight(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#FAEEDA', color: '#633806', borderRadius: 2, padding: '0 2px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function Initials({ name, bg, color }: { name: string; bg: string; color: string }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('');
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 500, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function EntityIcon({ bg, color, Icon }: { bg: string; color: string; Icon: React.ElementType }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 8,
      background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon style={{ fontSize: 17 }} />
    </div>
  );
}

function SectionHeader({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '12px 16px 6px',
      position: 'sticky', top: 0,
      background: '#fff', zIndex: 2,
      borderBottom: '0.5px solid rgba(0,0,0,0.07)',
    }}>
      <Icon style={{ fontSize: 15, color: 'rgba(0,0,0,0.38)' }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
      <span style={{ marginLeft: 6, fontSize: 13, color: 'rgba(0,0,0,0.38)', fontWeight: 400 }}>
        {count} {count === 1 ? 'result' : 'results'}
      </span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: 'rgba(0,0,0,0.05)',
      border: '0.5px solid rgba(0,0,0,0.12)',
      borderRadius: 4, padding: '1px 6px',
      fontSize: 11, fontFamily: 'monospace',
    }}>
      {children}
    </span>
  );
}

const ResultRow = React.forwardRef<HTMLDivElement, {
  entity: SearchEntityItem;
  query: string;
  onSelect: (entity: SearchEntityItem) => void;
  icon: React.ReactNode;
  testId: string;
  isFocused: boolean;
}>(function ResultRow({ entity, query, onSelect, icon, testId, isFocused }, ref) {
  const statusColor = entity.status?.toLowerCase() === 'active'
    ? { bg: '#EAF3DE', color: '#3B6D11' }
    : { bg: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.45)' };

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isFocused}
      tabIndex={-1}
      data-testid={testId}
      onClick={() => onSelect(entity)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 16px',
        cursor: 'pointer',
        background: isFocused ? 'rgba(0,0,0,0.05)' : 'transparent',
        transition: 'background 0.1s',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isFocused) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.035)';
      }}
      onMouseLeave={(e) => {
        if (!isFocused) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(0,0,0,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {highlight(entity.displayName, query)}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
          {entity.primaryIdentifiers.join(' · ')}
        </div>
      </div>
      <span style={{
        fontSize: 12, padding: '3px 9px', borderRadius: 100,
        background: statusColor.bg, color: statusColor.color,
        fontWeight: 500, flexShrink: 0, textTransform: 'capitalize',
      }}>
        {entity.status || 'Active'}
      </span>
    </div>
  );
});

export default function CustomerSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('customer');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [, setLocation] = useLocation();

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<SectionKey, HTMLDivElement>>>({});
  const rowRefs = useRef<HTMLDivElement[]>([]);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset focus when results change
  useEffect(() => {
    setFocusedIndex(-1);
    rowRefs.current = [];
  }, [debouncedQuery]);

  const searchUrl = `/api/customers/search?q=${encodeURIComponent(debouncedQuery)}&entityTypes=customer,account,household&limit=100`;

  const { data: unifiedResults, isLoading: searchLoading } = useQuery({
    queryKey: [searchUrl],
    enabled: debouncedQuery.length > 0,
    select: (data: UnifiedSearchResult) => data,
  });

  const grouped = (unifiedResults?.data ?? []).reduce((acc, entity) => {
    if (!acc[entity.entityType]) acc[entity.entityType] = [];
    acc[entity.entityType].push(entity);
    return acc;
  }, {} as Record<string, SearchEntityItem[]>);

  const customerResults = grouped['customer'] ?? [];
  const accountResults = grouped['account'] ?? [];
  const householdResults = grouped['household'] ?? [];
  const allResults = (unifiedResults?.data || [])
  const totalResults = allResults.length;
  const hasAnyResults = totalResults > 0;

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setShowResults(query.length > 0);
    setActiveSection('customer');
    setFocusedIndex(-1);
  };

  const handleClear = () => {
    setSearchQuery('');
    setShowResults(false);
    setFocusedIndex(-1);
    inputRef.current?.focus();
  };

  const handleEntitySelect = (entity: SearchEntityItem) => {
    setSearchQuery('');
    setShowResults(false);
    setFocusedIndex(-1);
    if (entity.entityType === 'customer') {
      const customer: Customer = {
        id: entity.entityId.toString(),
        customerId: entity.entityId,
        name: entity.displayName,
        accountNumber: entity.customer?.silverlakeCustomerId || 'N/A',
        riskRating: 'medium',
        status: entity.status || 'active',
      };
      setLocation(generateCustomerUrl(customer.customerId || customer.id));
    } else if (entity.entityType === 'account') {
      setLocation(`/ciq/accounts?accountId=${entity.entityId}&customerId=${entity.account?.customerId}`);
    } else if (entity.entityType === 'household') {
      setLocation(`/ciq/household?householdId=${entity.entityId}`);
    }
  };

  // Keyboard nav on the wrapper — arrow keys are captured here, not stolen by the input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults) return;

    if (e.key === 'Escape') {
      setShowResults(false);
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(focusedIndex + 1, allResults.length - 1);
      setFocusedIndex(next);
      rowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(focusedIndex - 1, 0);
      setFocusedIndex(prev);
      rowRefs.current[prev]?.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < allResults.length) {
      e.preventDefault();
      handleEntitySelect(allResults[focusedIndex]);
    }
  };

  const isJumpingRef = useRef(false);

  const jumpTo = (section: SectionKey) => {
    setActiveSection(section);
    isJumpingRef.current = true;
    // set the ref to false in 150ms after the jump occurs
    setTimeout(() => { isJumpingRef.current = false; }, 150);
    if (!scrollRef.current) return;
    const target = sectionRefs.current[section];
    if (target) {
      scrollRef.current.scrollTop = target.offsetTop - scrollRef.current.offsetTop;
    }
  };

  const handleScroll = useCallback(() => {
    // ignore scroll events when jumping
    if (isJumpingRef.current) return; 
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    let current: SectionKey = 'customer';
    for (const key of SECTION_ORDER) {
      if (countFor(key) === 0) continue;
      const el = sectionRefs.current[key];
      if (el && el.offsetTop - (scrollRef.current.offsetTop ?? 0) <= scrollTop + 12) {
        current = key;
      }
    }
    setActiveSection(current);
  }, []);

  const countFor = (key: string) => grouped[key]?.length ?? 0;

  const jumpBtnStyle = (section: SectionKey): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 13,
    padding: '4px 12px',
    borderRadius: 100,
    border: activeSection === section ? '0.5px solid transparent' : '0.5px solid rgba(0,0,0,0.12)',
    background: activeSection === section ? '#1a1a1a' : 'transparent',
    color: activeSection === section ? '#fff' : 'rgba(0,0,0,0.55)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.12s, color 0.12s',
    whiteSpace: 'nowrap',
  });

  // Row index increments across all three sections so keyboard nav indexes correctly
  let rowIndex = 0;

  const renderSection = (
    key: SectionKey,
    results: SearchEntityItem[],
    renderIcon: (entity: SearchEntityItem) => React.ReactNode,
  ) => {
    if (results.length === 0) return null;
    const cfg = SECTION_CONFIG[key];
    return (
      <div key={key} ref={(el) => { if (el) sectionRefs.current[key] = el as HTMLDivElement; }}>
        <SectionHeader icon={cfg.icon} label={cfg.label} count={results.length} />
        {results.map((entity) => {
          const idx = rowIndex++;
          return (
            <ResultRow
              key={`${key}-${entity.entityId}`}
              entity={entity}
              query={searchQuery}
              onSelect={handleEntitySelect}
              icon={renderIcon(entity)}
              testId={`${key}-result-${entity.entityId}`}
              isFocused={idx === focusedIndex}
              ref={(el) => { if (el) rowRefs.current[idx] = el; }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', width: 400, marginLeft: 'auto' }}
      onKeyDown={handleKeyDown}
    >
      <TextField
        inputRef={inputRef}
        sx={{ width: '100%', mt: 1, mb: 1 }}
        variant="outlined"
        placeholder="Search clients, accounts, households…"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => { if (searchQuery.length > 0) setShowResults(true); }}
        data-testid="input-customer-search"
        slotProps={{
          input: {
            sx: {
              backgroundColor: '#ffffff',
              fontSize: 15,
              '& fieldset': { border: 'none' },
            },
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="secondary" style={{ fontSize: 20 }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <button
                  onClick={handleClear}
                  aria-label="Clear search"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 2, display: 'flex', alignItems: 'center',
                    color: 'rgba(0,0,0,0.38)', borderRadius: 4,
                  }}
                >
                  <Close style={{ fontSize: 18 }} />
                </button>
              </InputAdornment>
            ) : undefined,
            size: 'small',
          },
        }}
      />

      <Fade in={showResults}>
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 1000,
          width: 460, background: '#fff',
          border: '0.5px solid rgba(0,0,0,0.15)',
          borderRadius: 12, marginTop: 4,
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        }}>
          {/* Jump bar */}
          <div style={{
            display: 'flex', gap: 6, padding: '10px 12px',
            borderBottom: '0.5px solid rgba(0,0,0,0.08)',
          }}>
            <button style={jumpBtnStyle('customer')} disabled={countFor('customer') === 0} onClick={() => jumpTo('customer')}>
              <Person style={{ fontSize: 14 }} />
              Clients
              {countFor('customer') > 0 && (
                <span style={{ fontSize: 11, opacity: 0.65 }}>{countFor('customer')}</span>
              )}
            </button>
            <button style={jumpBtnStyle('account')} disabled={countFor('account') === 0} onClick={() => jumpTo('account')}>
              <AccountBalance style={{ fontSize: 14 }} />
              Accounts
              {countFor('account') > 0 && (
                <span style={{ fontSize: 11, opacity: 0.65 }}>{countFor('account')}</span>
              )}
            </button>
            <button style={jumpBtnStyle('household')} disabled={countFor('household') === 0} onClick={() => jumpTo('household')}>
              <Groups style={{ fontSize: 14 }} />
              Households
              {countFor('household') > 0 && (
                <span style={{ fontSize: 11, opacity: 0.65 }}>{countFor('household')}</span>
              )}
            </button>
          </div>

          {/* Scrollable results */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{ maxHeight: 400, overflowY: 'auto' }}
          >
            {searchLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '28px 16px', color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>
                <CircularProgress size={18} thickness={4} />
                Searching…
              </div>
            ) : !hasAnyResults && debouncedQuery.length > 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'rgba(0,0,0,0.38)', fontSize: 14 }}>
                No results for "{debouncedQuery}"
              </div>
            ) : (
              <>
                {renderSection('customer', customerResults, (e) => (
                  <Initials
                    name={e.displayName}
                    bg={SECTION_CONFIG.customer.avatarBg}
                    color={SECTION_CONFIG.customer.avatarColor}
                  />
                ))}
                {renderSection('account', accountResults, () => (
                  <EntityIcon
                    bg={SECTION_CONFIG.account.iconBg}
                    color={SECTION_CONFIG.account.iconColor}
                    Icon={AccountBalance}
                  />
                ))}
                {renderSection('household', householdResults, () => (
                  <EntityIcon
                    bg={SECTION_CONFIG.household.iconBg}
                    color={SECTION_CONFIG.household.iconColor}
                    Icon={Groups}
                  />
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            borderTop: '0.5px solid rgba(0,0,0,0.08)',
            fontSize: 12, color: 'rgba(0,0,0,0.35)',
          }}>
            <Kbd>↑↓</Kbd> navigate
            <Kbd>↵</Kbd> select
            <Kbd>esc</Kbd> close
            {totalResults > 0 && (
              <span style={{ marginLeft: 'auto' }}>
                {totalResults} result{totalResults !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </Fade>
    </div>
  );
}