import React, { useState, useEffect } from 'react';
import { Globe, CalendarIcon, Tag, ClipboardCopy } from 'lucide-react';
import { UploadSettings, Visibility } from '../../types'; 

interface CommonSettingsFormProps {
  settings: UploadSettings;
  onSettingsChange: <K extends keyof UploadSettings>(key: K, value: UploadSettings[K]) => void;
  platformId: string;
  platformName: string;
  allowScheduling?: boolean;
  onCopySettings?: () => void;
}

const CommonSettingsForm: React.FC<CommonSettingsFormProps> = ({
  settings,
  onSettingsChange,
  platformId,
  platformName,
  allowScheduling = false,
  onCopySettings
}) => {
  const [tagInputText, setTagInputText] = useState<string>('');

  useEffect(() => {
    setTagInputText(settings.tags ? settings.tags.join(', ') : '');
  }, [settings.tags]);

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInputText(e.target.value);
  };

  const handleTagInputBlur = () => {
    const tags = tagInputText
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    onSettingsChange('tags', tags);
    setTagInputText(tags.join(', '));
  };

  const handleDateChange = (dateString: string) => {
    const date = dateString ? new Date(dateString) : null;
    onSettingsChange('scheduledDate', date);
  };

  const getMinScheduleDate = () => {
     const minDate = new Date();
     minDate.setHours(minDate.getHours() + 1);
     return minDate.toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${platformId}-title`} className="mb-1 block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id={`${platformId}-title`}
          type="text"
          value={settings.title || ''}
          onChange={(e) => onSettingsChange('title', e.target.value)}
          placeholder={`Video title for ${platformName}`}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor={`${platformId}-description`} className="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id={`${platformId}-description`}
          value={settings.description || ''}
          onChange={(e) => onSettingsChange('description', e.target.value)}
          placeholder={`Video description for ${platformName}`}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${platformId}-visibility`} className="mb-1 block text-sm font-medium text-gray-700">
            <div className="flex items-center space-x-1">
              <Globe className="h-4 w-4 text-gray-500" />
              <span>Visibility</span>
            </div>
          </label>
          <select
            id={`${platformId}-visibility`}
            value={settings.visibility || 'public'}
            onChange={(e) => onSettingsChange('visibility', e.target.value as Visibility)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
            {allowScheduling &&
              <option value="scheduled">Scheduled</option>
            }
          </select>
          {allowScheduling && settings.visibility === 'scheduled' && (
            <p className="mt-1 text-xs text-gray-500">
              Video is private until publishing date.
            </p>
          )}
        </div>

        {allowScheduling && settings.visibility === 'scheduled' && (
          <div>
            <label htmlFor={`${platformId}-schedule-date`} className="mb-1 block text-sm font-medium text-gray-700">
              <div className="flex items-center space-x-1">
                <CalendarIcon className="h-4 w-4 text-gray-500" />
                <span>Publishing Date</span>
              </div>
            </label>
            <input
              id={`${platformId}-schedule-date`}
              type="datetime-local"
              value={settings.scheduledDate
                ? new Date(settings.scheduledDate.getTime() - (settings.scheduledDate.getTimezoneOffset() * 60000))
                    .toISOString()
                    .slice(0, 16)
                : ''}
              onChange={(e) => handleDateChange(e.target.value)}
              min={getMinScheduleDate()}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required={settings.visibility === 'scheduled'}
            />
             <p className="mt-1 text-xs text-gray-500">
                Must be in the future. Timezone based on your browser.
              </p>
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`${platformId}-tags`} className="mb-1 block text-sm font-medium text-gray-700">
          <div className="flex items-center space-x-1">
            <Tag className="h-4 w-4 text-gray-500" />
            <span>Tags (comma separated)</span>
          </div>
        </label>
        <input
          id={`${platformId}-tags`}
          type="text"
          value={tagInputText}
          onChange={handleTagInputChange}
          onBlur={handleTagInputBlur}
          placeholder="tag1, tag2, relevant keywords"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {onCopySettings && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCopySettings}
            className="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <ClipboardCopy className="mr-1.5 h-4 w-4 text-gray-500" />
            Copy these settings to other platforms
          </button>
        </div>
      )}
    </div>
  );
};

export default CommonSettingsForm;