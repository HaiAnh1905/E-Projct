import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CloudinaryService {
  private apiKey = '421779412439667';
  private apiSecret = '9BMYC6KU4RwhGywDlA_OvsyLDq4';
  private cloudName = 'dft-cloud';

  private async generateSha1(message: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async uploadImage(file: File): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const strToSign = `timestamp=${timestamp}${this.apiSecret}`;
    const signature = await this.generateSha1(strToSign);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', this.apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.warn('Cloudinary upload response notice:', errText);
        return await this.readFileAsDataUrl(file);
      }

      const data = await response.json();
      return data.secure_url || data.url || (await this.readFileAsDataUrl(file));
    } catch (err) {
      console.warn('Cloudinary network fallback to Data URL:', err);
      return await this.readFileAsDataUrl(file);
    }
  }

  readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
}
