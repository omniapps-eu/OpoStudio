"use client";

import dynamic from "next/dynamic";

const TtsApp = dynamic(() => import("./TtsApp"), { ssr: false });

export default function Home() {
  return <TtsApp />;
}
