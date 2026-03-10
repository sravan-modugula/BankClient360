import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { eventTracker } from '@/lib/eventTracker';
import { AuditEventType } from '@shared/auditEvents';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  children: ReactNode;
  module?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentStack = errorInfo.componentStack
      ? errorInfo.componentStack.slice(0, 1000)
      : undefined;

    eventTracker.track(AuditEventType.ERR_CLIENT, {
      action: `Client error: ${error.message}`,
      outcome: 'error',
      metadata: {
        errorName: error.name,
        errorMessage: error.message,
        componentStack,
      },
      module: this.props.module || 'error-boundary',
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            p: 4,
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            An unexpected error occurred. Please try again.
          </Typography>
          <Button variant="contained" onClick={this.handleRetry}>
            Try Again
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
