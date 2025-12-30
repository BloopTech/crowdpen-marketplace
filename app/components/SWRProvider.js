"use client";

import { SWRConfig } from "swr";
import axios from "axios";

// Client-side fetcher function
const fetcher = async (url) => {
  try {
    const res = await axios.get(url);
    return res.data;
  } catch (error) {
    console.error("SWR fetcher error:", error);
    throw error;
  }
};

export default function SWRProvider({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        onError: (error) => {
          console.error("SWR global error:", error);
        },
        revalidateOnFocus: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
