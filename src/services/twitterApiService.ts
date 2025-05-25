import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;

export interface TwitterUploadSuccessResponse {
  tweet: any;
}

export interface TwitterUploadErrorResponse {
  error: string;
}

type TwitterUploadApiResponse = TwitterUploadSuccessResponse | TwitterUploadErrorResponse;

export const uploadTwitterPost = async (
  file: File | undefined,
  text: string,
  sessionId?: string,
  onUploadProgress?: (progress: number) => void
): Promise<TwitterUploadSuccessResponse | { error: string }> => {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (text) formData.append('text', text);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
    };
    if (sessionId) {
      headers['Authorization'] = `Bearer ${sessionId}`;
    }
    const response = await axios.post<TwitterUploadApiResponse>(
      `${API_URL}/api/twitter/upload`,
      formData,
      {
        headers,
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onUploadProgress(percentCompleted);
          }
        }
      }
    );
    if ('error' in response.data) {
      return { error: response.data.error };
    }
    return response.data;
  } catch (error) {
    let errorMessage = 'Failed to upload to Twitter';
    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.error || error.message || errorMessage;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { error: errorMessage };
  }
};
