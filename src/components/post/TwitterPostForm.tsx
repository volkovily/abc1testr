import React, { useState } from 'react';
import CommonPostSettings from './CommonPostSettings';

interface TwitterPostFormProps {
  onSubmit: (payload: any) => void;
  isSubmitting?: boolean;
}

const TwitterPostForm: React.FC<TwitterPostFormProps> = ({ onSubmit, isSubmitting }) => {
  const [message, setMessage] = useState<string>('');
  const [imageFile, setImageFile] = useState<File|undefined>(undefined);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message && !imageFile) return;
    const payload: any = { message };
    if (imageFile) payload.imageFile = imageFile;
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
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      accept="image/*"
      label="Add a Photo (Optional)"
      buttonLabel="Publish to Twitter"
    />
  );
};

export default TwitterPostForm;
