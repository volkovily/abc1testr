import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Copy, CheckCheck, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { PlatformUploadResult } from '../../types';

interface PlatformUploadStatusProps {
  platformId: string;
  result: PlatformUploadResult | undefined; // Can be undefined initially
  renderEmbed?: (platformId: string, result: PlatformUploadResult) => React.ReactNode;
}

const PlatformUploadStatus: React.FC<PlatformUploadStatusProps> = ({ 
  platformId, 
  result,
  renderEmbed
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (copiedLink) {
      const timer = setTimeout(() => setCopiedLink(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [copiedLink]);

  const handleCopyLink = (link: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiedLink(true);
        toast.success('Link copied!');
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
        toast.error('Failed to copy link');
      });
  };

  const renderStatusIndicator = (status: PlatformUploadResult['status']) => {
    switch (status) {
      case 'pending':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500" title="Pending">
            <RefreshCw className="h-4 w-4" />
          </div>
        );
      case 'uploading':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600" title="Uploading">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        );
      case 'processing':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 text-yellow-600" title="Processing">
            <RefreshCw className="h-4 w-4 animate-spin" />
          </div>
        );
      case 'success':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600" title="Success">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        );
      case 'error':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600" title="Error">
            <AlertCircle className="h-4 w-4" />
          </div>
        );
      default:
        return null;
    }
  };

  const renderProgressBar = (progress: number, status: PlatformUploadResult['status']) => {
    const bgColor = 'bg-gray-200';
    let fillColor = 'bg-gray-500';

    switch (status) {
      case 'uploading': fillColor = 'bg-blue-500'; break;
      case 'processing': fillColor = 'bg-yellow-500'; break;
      case 'success': fillColor = 'bg-green-500'; break;
      case 'error': fillColor = 'bg-red-500'; break;
      case 'pending': return null; // Don't show bar for pending
    }

    return (
      <div className={`h-1.5 w-full overflow-hidden rounded-full ${bgColor}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillColor}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    );
  };

  if (!result || result.status === 'pending') {
    // Optionally render nothing or a placeholder when pending/no result
    return null; 
  }

  return (
    <div className="mt-4 space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      {/* Status summary */}
      <div className="flex items-center justify-between rounded-md bg-gray-50 p-3">
        <div className="flex items-center">
          {renderStatusIndicator(result.status)}
          <span className="ml-2 text-sm font-medium text-gray-700">
            {result.status === 'uploading' && 'Uploading...'}
            {result.status === 'processing' && 'Processing...'}
            {result.status === 'success' && 'Upload successful!'}
            {result.status === 'error' && 'Upload failed'}
          </span>
        </div>
        <span className="text-sm text-gray-500">
          {result.progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-1">
        {renderProgressBar(result.progress, result.status)}
      </div>

      {/* Error message */}
      {result.status === 'error' && result.error && (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">Error:</p>
          <p>{result.error}</p>
        </div>
      )}

      {/* Only show the link and embed for YouTube */}
      {result.status === 'success' && result.videoUrl && platformId === 'youtube' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 p-3">
          <a
            href={result.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-sm text-indigo-600 hover:text-indigo-800"
            title={result.videoUrl}
          >
            {result.videoUrl}
          </a>
          <div className="flex flex-shrink-0 space-x-2">
            <button
                type="button"
                onClick={(e) => result.videoUrl && handleCopyLink(result.videoUrl, e)}
                className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50"
                aria-label="Copy link"
            >
                {copiedLink ? (
                <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                ) : (
                <Copy className="h-3.5 w-3.5" />
                )}
            </button>
            <a
                href={result.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50"
                aria-label="Open link"
            >
                <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
      {/* Only show embed for YouTube */}
      {result.status === 'success' && platformId === 'youtube' && renderEmbed && renderEmbed(platformId, result)}

    </div>
  );
};

export default PlatformUploadStatus;