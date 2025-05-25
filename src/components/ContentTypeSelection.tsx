import React from 'react';

interface ContentTypeSelectionProps {
  onSelect: (type: 'video' | 'post') => void;
}

const ContentTypeSelection: React.FC<ContentTypeSelectionProps> = ({ onSelect }) => (
  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
      <h2 className="text-sm font-medium text-gray-800">Choose Content Type</h2>
    </div>
    <div className="p-6 text-center">
      <p className="mb-4 text-base text-gray-600">What do you want to post today?</p>
      <div className="flex justify-center space-x-4">
        <button
          onClick={() => onSelect('video')}
          className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >Video</button>
        <button
          onClick={() => onSelect('post')}
          className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
        >Post</button>
      </div>
    </div>
  </div>
);

export default ContentTypeSelection;