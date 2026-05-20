import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { modelName, payload, apiKey: clientApiKey } = body;
    
    // Usar la clave enviada por el cliente si existe, si no, usar la variable de entorno del servidor
    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: { 
            message: "Falta la API Key de Gemini. Por favor configúrala en Vercel (GEMINI_API_KEY) o introdúcela en la interfaz." 
          } 
        }, 
        { status: 400 }
      );
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: { message: error.message || "Error interno en el proxy del servidor." } }, 
      { status: 500 }
    );
  }
}
