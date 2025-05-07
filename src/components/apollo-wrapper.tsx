// src/components/ApolloWrapper.tsx (updated)
'use client';

import { ApolloProvider, ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { ReactNode, useEffect, useState } from "react";
import { getCookie } from 'cookies-next';

export default function ApolloWrapper({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ApolloClient<any> | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Create HTTP link to your GraphQL server
    const httpLink = createHttpLink({
      uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql",
      credentials: 'include'
    });

    // Add auth headers to requests
    const authLink = setContext((_, { headers }) => {
      const token = getCookie('token');
      return {
        headers: {
          ...headers,
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      };
    });

    // Initialize Apollo Client
    const apolloClient = new ApolloClient({
      link: authLink.concat(httpLink),
      cache: new InMemoryCache(),
      connectToDevTools: process.env.NODE_ENV !== 'production',
    });

    setClient(apolloClient);
  }, []);

  if (!client) {
    return null;
  }

  return (
    <ApolloProvider client={client}>
      {children}
    </ApolloProvider>
  );
}