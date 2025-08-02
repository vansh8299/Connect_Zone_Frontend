// context/UserContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { useRouter } from 'next/router';

const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    currentUser {
      id
      firstName
      lastName
      email
      avatar
    }
  }
`;

const UserContext = createContext<any>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, loading, error } = useQuery(GET_CURRENT_USER);
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    if (data?.currentUser) {
      setUser(data.currentUser);
    } else if (error) {
      // Handle error or redirect to login
      router.push('/login');
    }
  }, [data, error, router]);
  
  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}