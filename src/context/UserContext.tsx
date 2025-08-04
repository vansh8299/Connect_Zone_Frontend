// context/UserContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { GET_CURRENT_USER } from '@/graphql/query/callquery';



const UserContext = createContext<any>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, loading, error } = useQuery(GET_CURRENT_USER);
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    if (data?.currentUser) {
      setUser(data.currentUser);
    } else if (error) {
 
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