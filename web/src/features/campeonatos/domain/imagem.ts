import { api } from "../../../lib/api";

export const compressImageFromBase64 = (base64: string, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
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

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
};

export const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      compressImageFromBase64(event.target?.result as string, maxWidth, maxHeight, quality)
        .then(resolve)
        .catch(reject);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const base64ToBlob = (base64: string): { blob: Blob; mime: string } => {
  const parts = base64.split(';base64,');
  const mime = parts[0].split(':')[1];
  const byteCharacters = atob(parts[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return { blob: new Blob([byteArray], { type: mime }), mime };
};

export const uploadBase64ToStorage = async (base64Str: string, folderName: string, prefixName: string): Promise<string> => {
  if (!base64Str || !base64Str.startsWith('data:image/')) return base64Str;

  try {
    const { blob, mime } = base64ToBlob(base64Str);
    const extension = mime.split('/')[1] || 'jpeg';
    const fileName = `${prefixName}-${Date.now()}.${extension}`;

    const file = new File([blob], fileName, { type: mime });
    const { url } = await api.upload(file, 'public-images', folderName);

    return url;
  } catch (err) {
    console.error('Falha ao enviar imagem para o servidor:', err);
    return base64Str;
  }
};

export const processTournamentImages = async (t: any, id: string): Promise<any> => {
  const logoUrl = await uploadBase64ToStorage(t.logoUrl || t.logo_url, 'campeonatos', `${id}-logo`);
  const bannerUrl = await uploadBase64ToStorage(t.bannerUrl || t.banner_url, 'campeonatos', `${id}-banner`);
  const orgPhotoUrl = await uploadBase64ToStorage(t.orgPhotoUrl || t.org_photo_url, 'campeonatos', `${id}-org`);
  return {
    ...t,
    logoUrl,
    logo_url: logoUrl,
    bannerUrl,
    banner_url: bannerUrl,
    orgPhotoUrl,
    org_photo_url: orgPhotoUrl,
  };
};