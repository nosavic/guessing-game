import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster position="top-right" />
      <div className="bottom-0 left-0 absolute flex justify-center opacity-50 w-[100%] font-bold text-[20px] text-white">
        by Nosakhare Victory Efosa
      </div>
    </>
  );
}
