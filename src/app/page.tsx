"use client";

import dynamic from "next/dynamic";

const TemaAClaseApp = dynamic(() => import("./tema-a-clase/TemaAClaseApp"), { ssr: false });

export default function Home() {
  return <TemaAClaseApp />;
}
