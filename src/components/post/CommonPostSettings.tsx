import React from 'react';
import { Loader2 } from 'lucide-react';

interface CommonPostSettingsProps {
  message: string;
  setMessage: (msg: string) => void;
  imageFile?: File;
  setImageFile: (file?: File) => void;
  mediaPreview: string | null;
  setMediaPreview: (url: string | null) => void;
  isSubmitting?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  accept?: string;
  label?: string;
  buttonLabel?: string;
  children?: React.ReactNode;
}

const CommonPostSettings: React.FC<CommonPostSettingsProps> = ({
  message,
  setMessage,
  imageFile,
  setImageFile,
  mediaPreview,
  setMediaPreview,
  isSubmitting,
  onSubmit,
  accept = 'image/*',
  label = 'Add a Photo (Optional)',
  buttonLabel = 'Publish',
  children
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {children}
      <div>
        <label className="block text-sm font-medium text-gray-700">Message</label>
        <textarea
          placeholder="Enter your message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          rows={4}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <input
          type="file"
          accept={accept}
          onChange={e => {
            const file = e.target.files?.[0];
            setImageFile(file);
            setMediaPreview(file ? URL.createObjectURL(file) : null);
          }}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {mediaPreview && (
          <img
            src={mediaPreview}
            alt="Selected media"
            className="mt-2 h-24 w-24 rounded-md object-cover border border-gray-300"
          />
        )}
      </div>
      <div className="flex items-center justify-end border-t border-gray-100 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {buttonLabel}
        </button>
      </div>
    </form>
  );
};

export default CommonPostSettings;
