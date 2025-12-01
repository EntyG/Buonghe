import { StoredImage } from "../redux/slices/chatSlice";

/**
 * Convert File to base64 data URL for storage
 */
export const fileToStoredImage = async (file: File): Promise<StoredImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        dataUrl: reader.result as string,
        fileName: file.name,
        fileType: file.type,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Convert StoredImage back to File object
 */
export const storedImageToFile = (storedImage: StoredImage): File => {
  // Convert base64 data URL to blob
  const arr = storedImage.dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || storedImage.fileType;
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  const blob = new Blob([u8arr], { type: mime });
  
  // Create File from Blob
  return new File([blob], storedImage.fileName, { type: mime });
};
