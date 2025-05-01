  export const extractUserIdFromToken = (token: string): string | null => {
      try {
        // For JWT tokens, they are usually in the format: header.payload.signature
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        
        const payload = JSON.parse(jsonPayload);
        return payload.userId || payload.sub || null;
      } catch (error) {
        console.error('Error extracting user ID from token:', error);
        return null;
      }
    };