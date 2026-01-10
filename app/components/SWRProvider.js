"use client";

import { SWRConfig } from "swr";
import axios from "axios";
import { reportClientError } from "../lib/observability/reportClientError";

// Client-side fetcher function
const fetcher = async (url) => {
  try {
    const res = await axios.get(url);
    return res.data;
  } catch (error) {
    await reportClientError(error, {
      tag: "swr_fetcher_error",
      extra: { url },
    });
    throw error;
  }
};

export default function SWRProvider({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        onError: async (error) => {
          await reportClientError(error, {
            tag: "swr_global_error",
          });
        },
        revalidateOnFocus: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
