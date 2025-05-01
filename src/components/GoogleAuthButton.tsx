// components/GoogleAuthButton.tsx
import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { GOOGLE_AUTH_MUTATION } from '@/graphql/query/query';
import { useRouter } from 'next/navigation';
import { setCookie } from 'cookies-next';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleAuthButtonProps {
  text?: string;
  className?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  text = 'Continue with Google',
  className = '',
  onSuccess,
  onError
}) => {
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const [googleAuth, { loading }] = useMutation(GOOGLE_AUTH_MUTATION);

  useEffect(() => {
    // Load the Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (loaded && window.google) {
      const buttonElement = document.getElementById('google-signin-button');
      if (buttonElement) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });
        
        window.google.accounts.id.renderButton(
          buttonElement,
          { 
            theme: 'outline', 
            size: 'large',
            text: 'continue_with',
            width: buttonElement.offsetWidth 
          }
        );
      }
    }
  }, [loaded]);
  const handleCredentialResponse = async (response: any) => {
    try {
      const { data } = await googleAuth({
        variables: {
          input: {
            idToken: response.credential,
          },
        },
      });

      if (data?.googleAuth) {
        // Set HTTP-only cookie (server-side)
        setCookie('token', data.googleAuth.token, {
          maxAge: 60 * 60 * 24 * 7, // 1 week
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });
        
        // Client-accessible user data
        setCookie('user', JSON.stringify(data.googleAuth.user), {
          maxAge: 60 * 60 * 24 * 7, // 1 week
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });
        
        if (onSuccess) onSuccess();
        router.push('/pages/chats');
      }
    } catch (error) {
      console.error('Google auth failed:', error);
      if (onError && error instanceof Error) onError(error);
    }
  };

  const handleGoogleSignIn = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  };

 return (
  <div className={`google-auth-container ${className}`}>
    {loaded ? (
        <div className='w-full py-2 px-6 text-sm font-medium text-gray-400'>
      <div id="google-signin-button" className="w-full"></div>
      </div>
    ) : (
      <div className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-400 bg-gray-100">
        Loading Google Sign-In...
      </div>
    )}
  </div>
);
};

export default GoogleAuthButton;