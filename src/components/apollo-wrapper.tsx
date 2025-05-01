'use client';

import { ApolloProvider, ApolloClient, InMemoryCache, createHttpLink, split } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
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
      credentials: 'include' // This ensures cookies are sent with requests
    });

    // Add auth headers to requests - using cookies
    const authLink = setContext((_, { headers }) => {
      const token = getCookie('token');
      return {
        headers: {
          ...headers,
          // Optionally add authorization header if required along with cookies
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      };
    });

    // Create WebSocket link for subscriptions
    const wsLink = new GraphQLWsLink(createClient({
      url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/graphql',
      connectionParams: () => {
        const token = getCookie('token');
        return {
          authorization: token ? `Bearer ${token}` : '',
        };
      },
    }));

    // Split links based on operation type
    // Use WebSocket for subscriptions, HTTP for queries and mutations
    const splitLink = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      authLink.concat(httpLink)
    );

    // Initialize Apollo Client with the split link
    const apolloClient = new ApolloClient({
      link: splitLink,
      cache: new InMemoryCache(),
      connectToDevTools: process.env.NODE_ENV !== 'production',
    });

    setClient(apolloClient);
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