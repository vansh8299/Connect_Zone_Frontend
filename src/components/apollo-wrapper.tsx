// src/components/ApolloWrapper.tsx (fixed)
"use client";

import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  createHttpLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { ReactNode, useEffect, useState } from "react";
import { getCookie } from "cookies-next";

import { UserProvider } from "@/context/UserContext";

export default function ApolloWrapper({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ApolloClient<any> | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    // Create HTTP link with better error handling
    const httpLink = createHttpLink({
      uri:
        process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql",
      credentials: "include",
      fetchOptions: {
        mode: "cors",
      },
    });

    // Add auth headers to requests with proper token handling
    const authLink = setContext((_, { headers }) => {
      const token = getCookie("token");
      console.log("Auth token available:", !!token);

      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      };
    });

    // Initialize Apollo Client with better error handling
    const apolloClient = new ApolloClient({
      link: authLink.concat(httpLink),
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              // Add field policies if needed
            },
          },
        },
      }),
      defaultOptions: {
        watchQuery: {
          fetchPolicy: "network-only",
          errorPolicy: "all",
        },
        query: {
          fetchPolicy: "network-only",
          errorPolicy: "all",
        },
        mutate: {
          errorPolicy: "all",
        },
      },
      connectToDevTools: process.env.NODE_ENV !== "production",
    });

    setClient(apolloClient);
  }, []);

  if (!client) {
    return null;
  }

  return (
    <ApolloProvider client={client}>
      <UserProvider>{children}</UserProvider>
    </ApolloProvider>
  );
}
