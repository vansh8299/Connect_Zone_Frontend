'use client';

import { ApolloProvider, ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { ReactNode, useEffect, useState } from "react";

// Create HTTP link to your GraphQL server
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql",
});

// Initialize Apollo Client
function createApolloClient() {
  // Add auth headers to requests
  const authLink = setContext((_, { headers }) => {
    // Get authentication token from local storage if available
    let token = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('token');
    }
    
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : "",
      }
    };
  });

  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
  });
}

export default function ApolloWrapper({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ApolloClient<any> | null>(null);

  useEffect(() => {
    // Initialize the client on the client side
    setClient(createApolloClient());
  }, []);

  if (!client) {
    return null; // or a loading spinner
  }

  return (
    <ApolloProvider client={client}>
      {children}
    </ApolloProvider>
  );
}