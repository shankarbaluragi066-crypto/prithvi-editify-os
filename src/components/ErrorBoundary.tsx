import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let parsedDetails: { error?: string; operationType?: string; path?: string } | null = null;
      try {
        parsedDetails = JSON.parse(this.state.errorMessage);
      } catch {
        parsedDetails = null;
      }

      return (
        <div className="min-h-screen bg-[#F5F5F1] flex items-center justify-center p-6">
          <div className="bg-white border border-[#E2E4DF] rounded-lg max-w-lg w-full p-8">
            <div className="flex items-center gap-3 text-[#B93832]">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-xl font-semibold text-[#172333]">Operation Interrupted</h1>
            </div>
            <p className="text-sm text-[#6E7785] mt-3 leading-relaxed">
              {parsedDetails?.error
                ? `Database security or connection check triggered on ${parsedDetails.operationType?.toUpperCase()} (${parsedDetails.path}): ${parsedDetails.error}`
                : this.state.errorMessage}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: '' });
                  window.location.reload();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
