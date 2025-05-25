import React from 'react';
import { ExternalLink, AlertCircle, LogOut, UserCircle, Loader2 } from 'lucide-react';
import { AuthInfo } from '../../types';

interface AuthStatusDisplayProps {
  platformName: string;
  platformIcon?: React.ReactNode;
  isAuthenticated: boolean;
  isLoading: boolean;
  authInfo: AuthInfo | null;
  error?: string | null;
  onLogout: () => void;
}

const AuthStatusDisplay: React.FC<AuthStatusDisplayProps> = ({
  platformName,
  platformIcon,
  isAuthenticated,
  isLoading,
  authInfo,
  error,
  onLogout,
}) => {

  if (isLoading) {
    return (
      <div className="mb-4 flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span>Checking {platformName} connection...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mb-4 flex items-center rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
        <span>Authentication required for {platformName}. Please go back and connect first.</span>
      </div>
    );
  }

  let profileUrl = authInfo?.profileUrl;
  if (platformName.toLowerCase() === 'facebook') {
    profileUrl = 'https://facebook.com';
  }

  // Authenticated state
  return (
    <div className="mb-4 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h3 className="text-xs font-medium text-gray-700">{platformName} Account</h3>
        {authInfo && profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-xs text-indigo-600 hover:underline"
          >
            View profile
          </a>
        )}
      </div>

      <div className="p-3">
        {error && (
           <div className="mb-3 flex items-center rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
               <AlertCircle className="mr-1.5 h-4 w-4 flex-shrink-0"/>
               <span>{error}</span>
           </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center">
            {authInfo?.imageUrl ? (
              <img 
                src={authInfo.imageUrl} 
                alt={`${authInfo.name} profile`}
                className="mr-3 h-10 w-10 flex-shrink-0 rounded-full border border-gray-200 object-cover" 
              />
            ) : platformIcon ? (
               <div className="mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500">
                  {React.cloneElement(platformIcon as React.ReactElement, { className: "h-6 w-6" })}
               </div>
            ) : (
               <UserCircle className="mr-3 h-10 w-10 flex-shrink-0 text-gray-400"/>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {authInfo?.name || `Connected to ${platformName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="ml-2 flex flex-shrink-0 items-center rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <LogOut className="mr-1 h-3.5 w-3.5" />
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthStatusDisplay;