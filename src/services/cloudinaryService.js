import realApi from './api/setupAxios.js';

// Cloudinary Configuration
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'i14k7hvk';
const API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY || '619871459582297';
const API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET || 'APdrXDmmW6cTt2gvDNpjMu63X2E';
const BASE_FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER || 'zanezion/support';

/**
 * Compute SHA-1 hash using Web Crypto API available in all modern browsers
 */
async function computeSha1(str) {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}

/**
 * Compress an image file to a lightweight Base64 string as emergency fallback
 */
export function compressImageFile(file, maxWidth = 1200, maxHeight = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (typeof file === 'string') return resolve(file);

    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL(file.type || 'image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload an attachment to Cloudinary CDN
 * Priority 1: Direct Cloudinary REST API with SHA-1 signature
 * Priority 2: Backend upload endpoint (/items/upload-image)
 * Priority 3: Compressed Base64 data URL
 *
 * @param {File|Blob|string} file - The file to upload
 * @param {string} subfolder - Subdirectory in Cloudinary (e.g. 'cases' or 'replies')
 * @returns {Promise<{ url: string, isCloudinary: boolean, fileName?: string }>}
 */
export async function uploadSupportAttachment(file, subfolder = 'cases') {
  if (!file) return { url: null, isCloudinary: false };

  const folderPath = `${BASE_FOLDER}/${subfolder}`;
  const timestamp = Math.floor(Date.now() / 1000);

  console.log('☁️ [CLOUDINARY_UPLOAD_INIT] Starting upload for attachment:', {
    name: file.name || 'unnamed',
    size: file.size ? `${(file.size / 1024).toFixed(2)} KB` : 'unknown',
    folder: folderPath
  });

  // Strategy 1: Direct signed upload to Cloudinary CDN
  try {
    const stringToSign = `folder=${folderPath}&timestamp=${timestamp}${API_SECRET}`;
    const signature = await computeSha1(stringToSign);

    if (signature) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', API_KEY);
      formData.append('timestamp', timestamp);
      formData.append('folder', folderPath);
      formData.append('signature', signature);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.secure_url) {
          console.log('🎉 [CLOUDINARY_UPLOAD_SUCCESS] Permanent URL created:', data.secure_url);
          return {
            url: data.secure_url,
            isCloudinary: true,
            fileName: file.name || 'attachment'
          };
        }
      } else {
        const errText = await response.text();
        console.warn('⚠️ [CLOUDINARY_DIRECT_FAILED] Status:', response.status, errText);
      }
    }
  } catch (directErr) {
    console.warn('⚠️ [CLOUDINARY_DIRECT_ERROR] Direct upload encountered an error:', directErr?.message || directErr);
  }

  // Strategy 2: Backend upload endpoint (/items/upload-image)
  try {
    console.log('🔄 [CLOUDINARY_FALLBACK] Attempting upload via backend endpoint...');
    const backendFormData = new FormData();
    backendFormData.append('image', file);

    const backendRes = await realApi.post('/items/upload-image', backendFormData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    const urlFromBackend = backendRes.data?.data?.url || backendRes.data?.url;
    if (urlFromBackend) {
      console.log('🎉 [BACKEND_UPLOAD_SUCCESS] Cloudinary URL returned from backend:', urlFromBackend);
      return {
        url: urlFromBackend,
        isCloudinary: true,
        fileName: file.name || 'attachment'
      };
    }
  } catch (backendErr) {
    console.warn('⚠️ [BACKEND_UPLOAD_ERROR] Backend endpoint failed:', backendErr?.message || backendErr);
  }

  // Strategy 3: Compressed Base64 fallback (guarantees user data is never lost)
  console.warn('⚠️ [CLOUDINARY_EMERGENCY_FALLBACK] Using compressed Base64 data URL');
  const base64Url = await compressImageFile(file);
  return {
    url: base64Url,
    isCloudinary: false,
    fileName: file.name || 'attachment'
  };
}

/**
 * Checks if a given URL is hosted on Cloudinary
 */
export function isCloudinaryUrl(url) {
  if (typeof url !== 'string') return false;
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
}
