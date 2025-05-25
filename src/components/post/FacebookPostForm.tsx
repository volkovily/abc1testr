import React, { useState, useEffect } from 'react';
import { useFacebookAuth } from '../../hooks/useFacebookAuth';
import CommonPostSettings from './CommonPostSettings';

interface FacebookPostFormProps {
  onSubmit: (payload: any) => void;
  isSubmitting?: boolean;
}

const FacebookPostForm: React.FC<FacebookPostFormProps> = ({ onSubmit, isSubmitting }) => {
  const { isAuthenticated, isLoading: authLoading, pages, fetchStatus } = useFacebookAuth();
  const [pageId, setPageId] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [imageFile, setImageFile] = useState<File|undefined>(undefined);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<boolean>(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!pageId && pages && pages.length > 0) {
      setPageId(pages[0].id);
    }
  }, [pageId, pages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageId || (!message && !imageFile)) return;
    const payload: any = { pageId, message };
    if (imageFile) payload.imageFile = imageFile;
    if (scheduled) {
      payload.published = false;
      payload.scheduledPublishTime = Math.floor(new Date(scheduledTime).getTime() / 1000);
    }
    onSubmit(payload);
  };

  return (
    <CommonPostSettings
      message={message}
      setMessage={setMessage}
      imageFile={imageFile}
      setImageFile={setImageFile}
      mediaPreview={mediaPreview}
      setMediaPreview={setMediaPreview}
      isSubmitting={isSubmitting || authLoading}
      onSubmit={handleSubmit}
      accept="image/*"
      label="Add a Photo (Optional)"
      buttonLabel="Publish to Facebook"
    >
      {/* Facebook Page Selection */}
      <div className="space-y-2 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">Select Facebook Page to Upload To</label>
        {authLoading ? (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Loading pages...</span>
          </div>
        ) : pages.length === 0 ? (
          <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-700">
            No Facebook Pages Found.
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
            {pages.map(page => (
              <div key={page.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50">
                <input
                  type="radio"
                  id={`fb-page-${page.id}`}
                  name="facebook-page"
                  value={page.id}
                  checked={pageId === page.id}
                  onChange={() => setPageId(page.id)}
                  className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                />
                <label htmlFor={`fb-page-${page.id}`} className="flex flex-1 items-center space-x-3 min-w-0 cursor-pointer">
                  {page.picture?.data?.url && (
                    <img
                      src={page.picture.data.url}
                      alt={page.name}
                      className="h-8 w-8 flex-shrink-0 rounded-md border border-gray-200 object-cover"
                    />
                  )}
                  <span className="block flex-1 truncate text-sm font-medium text-gray-700">{page.name}</span>
                  <a
                    href={`https://facebook.com/${page.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-shrink-0 text-xs text-indigo-600 hover:text-indigo-800"
                  >View</a>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Schedule Post */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={scheduled}
          onChange={e => setScheduled(e.target.checked)}
          className="h-4 w-4"
        />
        <label className="text-sm text-gray-700">Schedule post</label>
      </div>
      {scheduled && (
        <input
          type="datetime-local"
          value={scheduledTime}
          onChange={e => setScheduledTime(e.target.value)}
          className="mt-1 block max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      )}
    </CommonPostSettings>
  );
};

export default FacebookPostForm;
